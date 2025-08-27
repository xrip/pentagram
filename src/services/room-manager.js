// Room management with Trystero BitTorrent strategy
// Handles P2P room creation, joining, and peer communication

export class RoomManager {
    constructor() {
        this.room = null
        this.isConnected = false
        this.wakeLock = null
        
        // Connection monitoring and recovery
        this.connectionHealthTimer = null
        this.reconnectionAttempts = 0
        this.maxReconnectionAttempts = 5
        this.reconnectionDelay = 2000 // Start with 2 seconds
        this.maxReconnectionDelay = 30000 // Max 30 seconds
        this.reconnectionTimeout = null // Track active reconnection timeout
        this.isReconnecting = false
        this.lastConnectedTime = null
        this.connectionStable = false
        this.stableConnectionTimer = null
        
        // Peer health monitoring
        this.peerHealthChecks = new Map() // peerId -> last successful ping
        this.peerHealthTimer = null
        this.peerHealthInterval = 15000 // Check peer health every 15 seconds
        this.peerTimeoutThreshold = 30000 // Consider peer disconnected after 30 seconds
        
        // Room configuration storage for reconnection
        this.lastRoomConfig = null
        
        // User info for announcements
        this.username = null
        this.identity = null
        this.sendUserInfo = null
        
        this.config = {
            appId: 'pentagram-foo-v1',
            
            // Use reliable BitTorrent trackers
            relayUrls: [
                'wss://tracker.webtorrent.dev',
                'wss://tracker.openwebtorrent.com',
                'wss://tracker.ghostchu-services.top/announce',
                'wss://tracker.files.fm:7073/announce',
                'wss://tracker.btorrent.xyz'
            ],
            
            // Connect to multiple trackers simultaneously for better peer discovery
            relayRedundancy: 3, // Use 3 trackers simultaneously
            
            // WebRTC configuration
            rtcConfig: {
                iceServers: [
                    { urls: 'stun:global.stun.twilio.com:3478' },
                    { urls: 'stun:stun.services.mozilla.com:3478' },
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    {
                        urls: 'turn:relay1.expressturn.com:3480',
                        username: '000000002071633131',
                        credential: 'ca0MzQPfNpAFRA76TklRoOndCQQ='
                    }
                ]
            }
        }
        
        // Event callbacks
        this.onPeerJoinCallback = null
        this.onPeerLeaveCallback = null
        this.onConnectionStatusCallback = null
        
        // Trystero library
        this.trystero = null
        this.selfId = null
    }
    
    // Initialize Trystero library
    async init() {
        if (this.trystero) return
        
        try {
            // Import Trystero BitTorrent strategy from CDN
            const trysteroModule = await import('https://cdn.jsdelivr.net/npm/trystero@0.21.6/torrent/+esm')
            this.trystero = trysteroModule
            this.selfId = trysteroModule.selfId
            console.log('Trystero BitTorrent strategy initialized')
            console.log('Self ID:', this.selfId)
            console.log('Available methods:', Object.keys(trysteroModule))
        } catch (error) {
            console.error('Failed to initialize Trystero:', error)
            throw new Error('P2P library initialization failed')
        }
    }
    
    // Join or create a room
    async joinRoom(roomId, password = null, onError = null) {
        await this.init()
        
        if (this.room && !this.isReconnecting) {
            console.warn('Already in a room, leaving first')
            await this.leaveRoom()
            // Add a small delay to ensure cleanup is complete
            await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        try {
            const config = {
                ...this.config,
                password: password || null
            }
            
            // Store configuration for potential reconnection
            this.lastRoomConfig = { roomId, password, onError }
            
            console.log(`${this.isReconnecting ? 'Reconnecting to' : 'Joining'} room: ${roomId}`)
            console.log('Config:', { ...config, password: password ? '[HIDDEN]' : null })
            
            // Join room using Trystero BitTorrent strategy
            this.room = this.trystero.joinRoom(config, roomId)
            
            // Setup event handlers
            this.setupRoomEventHandlers()
            
            this.isConnected = true
            this.lastConnectedTime = Date.now()
            this.reconnectionAttempts = 0 // Reset retry count on success
            this.isReconnecting = false
            
            console.log(`Room ${this.isReconnecting ? 'reconnected' : 'joined'} successfully`)
            this.requestWakeLock()
            
            // Start connection health monitoring
            this.startConnectionHealthMonitoring()
            
            // Start peer health monitoring
            this.startPeerHealthMonitoring()
            
            // Mark connection as stable after 10 seconds
            this.stableConnectionTimer = setTimeout(() => {
                this.connectionStable = true
                console.log('Connection marked as stable')
            }, 10000)
            
            // Notify about connection status
            if (this.onConnectionStatusCallback) {
                this.onConnectionStatusCallback('connected')
            }
            
            return this.room
            
        } catch (error) {
            console.error('Failed to join room:', error)
            this.isConnected = false
            this.isReconnecting = false
            
            if (this.onConnectionStatusCallback) {
                this.onConnectionStatusCallback('failed')
            }
            
            // Attempt reconnection if this isn't the first attempt or if connection was stable
            if (this.connectionStable || this.reconnectionAttempts > 0) {
                this.scheduleReconnection()
            }
            
            throw error
        }
    }
    
    // Setup room event handlers
    setupRoomEventHandlers() {
        if (!this.room) return
        
        // Peer join events
        this.room.onPeerJoin(async (peerId) => {
            console.log(`Peer joined: ${peerId}`)
            
            // Initialize peer health tracking
            this.peerHealthChecks.set(peerId, Date.now())
            
            try {
                // Measure connection latency
                const latency = await this.room.ping(peerId)
                console.log(`P2P latency to ${peerId}: ${latency}ms`)
                
                // Update health check timestamp
                this.peerHealthChecks.set(peerId, Date.now())
            } catch (error) {
                console.warn(`Could not ping ${peerId}:`, error)
            }
            
            if (this.onPeerJoinCallback) {
                this.onPeerJoinCallback(peerId)
            }
        })
        
        // Peer leave events
        this.room.onPeerLeave((peerId) => {
            console.log(`Peer left: ${peerId}`)
            
            // Remove from health checks
            this.peerHealthChecks.delete(peerId)
            
            // Clean up peer audio
            this.removePeerAudio(peerId)
            
            if (this.onPeerLeaveCallback) {
                this.onPeerLeaveCallback(peerId)
            }
        })
        
        // Stream events (for voice chat)
        this.room.onPeerStream((stream, peerId, metadata) => {
            console.log(`Received stream from ${peerId}:`, metadata)
            
            try {
                // Handle audio streams
                if (metadata?.type === 'audio' && stream.getAudioTracks().length > 0) {
                    this.handleIncomingAudioStream(stream, peerId, metadata)
                }
            } catch (error) {
                console.error('Error handling peer stream:', error)
            }
        })
        
        console.log('Room event handlers setup complete')
    }
    
    // Handle incoming audio stream from peer
    handleIncomingAudioStream(stream, peerId, metadata) {
        console.log(`Handling audio stream from ${metadata?.username || peerId}`)
        
        try {
            // Create audio element for playback
            const audioElement = new Audio()
            audioElement.srcObject = stream
            audioElement.autoplay = true
            audioElement.controls = false
            audioElement.volume = 1.0
            
            // Store audio element reference
            if (!this.peerAudioElements) {
                this.peerAudioElements = new Map()
            }
            
            // Remove existing audio element if any
            if (this.peerAudioElements.has(peerId)) {
                const oldElement = this.peerAudioElements.get(peerId)
                oldElement.srcObject = null
                oldElement.remove()
            }
            
            // Store new audio element
            this.peerAudioElements.set(peerId, audioElement)
            
            // Handle stream ended event
            stream.addEventListener('ended', () => {
                console.log(`Audio stream ended for ${peerId}`)
                this.removePeerAudio(peerId)
            })
            
            // Handle individual track events
            stream.getAudioTracks().forEach(track => {
                track.addEventListener('ended', () => {
                    console.log(`Audio track ended for ${peerId}`)
                    this.removePeerAudio(peerId)
                })
            })
            
            console.log(`Audio playback started for ${metadata?.username || peerId}`)
            
        } catch (error) {
            console.error('Failed to setup audio playback:', error)
        }
    }
    
    // Remove peer audio playback
    removePeerAudio(peerId) {
        if (this.peerAudioElements && this.peerAudioElements.has(peerId)) {
            const audioElement = this.peerAudioElements.get(peerId)
            audioElement.srcObject = null
            audioElement.remove()
            this.peerAudioElements.delete(peerId)
            console.log(`Removed audio playback for ${peerId}`)
        }
    }
    
    // Create a communication action
    makeAction(actionId) {
        if (!this.room) {
            throw new Error('No room available')
        }
        
        console.log(`Creating action: ${actionId}`)
        return this.room.makeAction(actionId)
    }
    
    // Leave the current room with proper cleanup
    async leaveRoom() {
        if (!this.room) return
        
        console.log('Leaving room with full cleanup...')
        
        try {
            // Get all peer connections before leaving
            const peers = this.room.getPeers()
            console.log(`Closing ${peers.size} peer connections...`)
            
            // Close all peer connections explicitly
            for (const [peerId, connection] of peers) {
                try {
                    if (connection.connectionState !== 'closed') {
                        connection.close()
                        console.log(`Closed connection to peer: ${peerId}`)
                    }
                } catch (e) {
                    console.warn(`Error closing peer connection ${peerId}:`, e)
                }
            }
            
            // Leave the room (this should clean up remaining resources)
            this.room.leave()
            console.log('Room left successfully')
            
            // Clear room reference
            this.room = null
            
        } catch (error) {
            console.error('Error during room cleanup:', error)
            // Force clear room reference even if cleanup failed
            this.room = null
        }
        
        // Reset state
        this.isConnected = false
        this.connectionStable = false
        this.isReconnecting = false
        this.lastRoomConfig = null
        this.releaseWakeLock()
        
        // Stop monitoring
        this.stopConnectionHealthMonitoring()
        this.stopPeerHealthMonitoring()
        
        // Clear health checks
        this.peerHealthChecks.clear()
        
        // Clear timers
        if (this.stableConnectionTimer) {
            clearTimeout(this.stableConnectionTimer)
            this.stableConnectionTimer = null
        }
        
        if (this.reconnectionTimeout) {
            clearTimeout(this.reconnectionTimeout)
            this.reconnectionTimeout = null
        }
        
        if (this.onConnectionStatusCallback) {
            this.onConnectionStatusCallback('disconnected')
        }
    }
    
    // Get connected peers
    getPeers() {
        if (!this.room) return new Map()
        
        try {
            return this.room.getPeers()
        } catch (error) {
            console.warn('Could not get peers:', error)
            return new Map()
        }
    }
    
    // Get connection status to trackers
    getTrackerStatus() {
        if (!this.trystero) return []
        
        try {
            const sockets = this.trystero.getRelaySockets?.()
            if (!sockets) return []
            
            return Object.entries(sockets).map(([url, socket]) => ({
                url,
                readyState: socket.readyState,
                connected: socket.readyState === WebSocket.OPEN
            }))
        } catch (error) {
            console.warn('Could not get tracker status:', error)
            return []
        }
    }
    
    // Ping a specific peer
    async pingPeer(peerId) {
        if (!this.room) {
            throw new Error('No room available')
        }
        
        try {
            const latency = await this.room.ping(peerId)
            return latency
        } catch (error) {
            console.warn(`Failed to ping ${peerId}:`, error)
            return null
        }
    }
    
    // Add audio stream for voice chat
    addStream(stream, targetPeers = null, metadata = null) {
        if (!this.room) {
            throw new Error('No room available')
        }
        
        try {
            this.room.addStream(stream, targetPeers, metadata)
            console.log('Audio stream added')
        } catch (error) {
            console.error('Failed to add stream:', error)
            throw error
        }
    }
    
    // Remove audio stream
    removeStream(stream, targetPeers = null) {
        if (!this.room) return
        
        try {
            this.room.removeStream(stream, targetPeers)
            console.log('Audio stream removed')
        } catch (error) {
            console.error('Failed to remove stream:', error)
        }
    }
    
    // Set event callbacks
    onPeerJoin(callback) {
        this.onPeerJoinCallback = callback
    }
    
    onPeerLeave(callback) {
        this.onPeerLeaveCallback = callback
    }
    
    onConnectionStatus(callback) {
        this.onConnectionStatusCallback = callback
    }
    
    // Set callback for when client needs to re-announce after reconnection
    onReconnected(callback) {
        this.onReconnectedCallback = callback
    }
    
    // Set user info for announcements
    setUserInfo(username, identity, sendUserInfo) {
        this.username = username
        this.identity = identity
        this.sendUserInfo = sendUserInfo
        console.log('Room manager user info set:', { username, hasIdentity: !!identity, hasSendUserInfo: !!sendUserInfo })
    }
    
    // Get self peer ID
    getSelfId() {
        return this.selfId
    }
    
    // Check if currently connected to room
    isRoomConnected() {
        return this.isConnected && this.room !== null
    }
    
    // Get room connection info
    getConnectionInfo() {
        if (!this.isConnected || !this.room) {
            return {
                connected: false,
                peers: 0,
                trackers: []
            }
        }
        
        return {
            connected: true,
            selfId: this.selfId,
            peers: this.getPeers().size,
            trackers: this.getTrackerStatus()
        }
    }

    // Request a screen wake lock to prevent the device from sleeping
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen wake lock acquired');

                this.wakeLock.addEventListener('release', () => {
                    console.log('Screen wake lock released');
                });
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        } else {
            console.warn('Wake Lock API not supported.');
        }
    }

    // Release the screen wake lock
    async releaseWakeLock() {
        if (this.wakeLock !== null) {
            await this.wakeLock.release();
            this.wakeLock = null;
        }
    }

    // Connection health monitoring methods
    startConnectionHealthMonitoring() {
        this.stopConnectionHealthMonitoring()
        
        this.connectionHealthTimer = setInterval(async () => {
            await this.checkConnectionHealth()
        }, 10000) // Check every 10 seconds
        
        console.log('Connection health monitoring started')
    }
    
    stopConnectionHealthMonitoring() {
        if (this.connectionHealthTimer) {
            clearInterval(this.connectionHealthTimer)
            this.connectionHealthTimer = null
            console.log('Connection health monitoring stopped')
        }
    }
    
    async checkConnectionHealth() {
        if (!this.isConnected || !this.room) {
            return
        }
        
        try {
            // Check tracker connections
            const trackerStatus = this.getTrackerStatus()
            const connectedTrackers = trackerStatus.filter(t => t.connected).length
            
            if (connectedTrackers === 0) {
                console.warn('No tracker connections available, connection may be unstable')
                
                // If we've been disconnected from all trackers for too long, trigger reconnection
                if (this.connectionStable) {
                    console.warn('All tracker connections lost, scheduling reconnection')
                    this.handleConnectionLoss() // Fire and forget - async handling
                }
            }
            
            // Try to ping the room to verify connectivity
            const peers = this.getPeers()
            if (peers.size > 0) {
                // Test connectivity to first peer
                const firstPeer = Array.from(peers.keys())[0]
                try {
                    await this.room.ping(firstPeer, 5000) // 5 second timeout
                } catch (pingError) {
                    console.warn(`Failed to ping peer ${firstPeer}, connection may be unstable`)
                }
            }
            
        } catch (error) {
            console.warn('Connection health check failed:', error)
            if (this.connectionStable) {
                this.handleConnectionLoss() // Fire and forget - async handling
            }
        }
    }
    
    async handleConnectionLoss() {
        if (this.isReconnecting) {
            return // Already handling reconnection
        }
        
        console.log('Connection loss detected, initiating reconnection process')
        
        this.isConnected = false
        this.connectionStable = false
        
        if (this.onConnectionStatusCallback) {
            this.onConnectionStatusCallback('reconnecting')
        }
        
        await this.scheduleReconnection()
    }
    
    async scheduleReconnection() {
        if (this.isReconnecting || !this.lastRoomConfig) {
            return
        }
        
        if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
            console.error(`Max reconnection attempts (${this.maxReconnectionAttempts}) reached`)
            this.isReconnecting = false
            
            // Final cleanup attempt to prevent connection leaks
            if (this.room) {
                try {
                    // Use immediate cleanup for failed reconnection
                    if (this.room.getPeers) {
                        const peers = this.room.getPeers()
                        for (const [peerId, connection] of peers) {
                            try {
                                if (connection.connectionState !== 'closed') {
                                    connection.close()
                                }
                            } catch (e) {
                                console.warn(`Error closing peer ${peerId}:`, e)
                            }
                        }
                    }
                    this.room.leave()
                    this.room = null
                } catch (e) {
                    console.warn('Final cleanup error:', e)
                    this.room = null
                }
            }
            
            if (this.onConnectionStatusCallback) {
                this.onConnectionStatusCallback('failed')
            }
            return
        }
        
        this.reconnectionAttempts++
        this.isReconnecting = true
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
            this.reconnectionDelay * Math.pow(1.5, this.reconnectionAttempts - 1),
            this.maxReconnectionDelay
        )
        
        console.log(`Scheduling reconnection attempt ${this.reconnectionAttempts}/${this.maxReconnectionAttempts} in ${delay}ms`)
        
        // Clear any existing reconnection timeout to prevent stacking
        if (this.reconnectionTimeout) {
            clearTimeout(this.reconnectionTimeout)
            console.log('Cleared existing reconnection timeout')
        }
        
        this.reconnectionTimeout = setTimeout(async () => {
            if (!this.isReconnecting || !this.lastRoomConfig) {
                return
            }
            
            try {
                console.log(`Reconnection attempt ${this.reconnectionAttempts}/${this.maxReconnectionAttempts}`)
                
                // Clean up current room if exists
                if (this.room) {
                    try {
                        await this.leaveRoom()
                        // Wait a bit longer for cleanup to complete
                        await new Promise(resolve => setTimeout(resolve, 200))
                    } catch (e) {
                        console.warn('Error leaving room during reconnection:', e)
                        // Force clear even if cleanup failed
                        this.room = null
                    }
                }
                
                // Attempt to rejoin
                const { roomId, password, onError } = this.lastRoomConfig
                await this.joinRoom(roomId, password, onError)
                
                // Trigger re-announcement after successful reconnection
                if (this.onReconnectedCallback) {
                    this.onReconnectedCallback()
                }
                
            } catch (error) {
                console.error(`Reconnection attempt ${this.reconnectionAttempts} failed:`, error)
                
                // Schedule next attempt
                await this.scheduleReconnection()
            }
        }, delay)
    }
    
    // Peer health monitoring methods
    startPeerHealthMonitoring() {
        this.stopPeerHealthMonitoring()
        
        this.peerHealthTimer = setInterval(async () => {
            await this.checkPeerHealth()
        }, this.peerHealthInterval)
        
        console.log('Peer health monitoring started')
    }
    
    stopPeerHealthMonitoring() {
        if (this.peerHealthTimer) {
            clearInterval(this.peerHealthTimer)
            this.peerHealthTimer = null
            console.log('Peer health monitoring stopped')
        }
    }
    
    async checkPeerHealth() {
        if (!this.isConnected || !this.room) {
            return
        }
        
        const now = Date.now()
        const peersToCheck = Array.from(this.peerHealthChecks.entries())
        
        for (const [peerId, lastHealthCheck] of peersToCheck) {
            const timeSinceLastCheck = now - lastHealthCheck
            
            if (timeSinceLastCheck > this.peerTimeoutThreshold) {
                console.warn(`Peer ${peerId} hasn't responded in ${timeSinceLastCheck}ms, removing from health checks`)
                this.peerHealthChecks.delete(peerId)
                continue
            }
            
            try {
                // Ping the peer to check connectivity
                const latency = await this.room.ping(peerId, 10000) // 10 second timeout
                
                if (latency !== null) {
                    // Update health check timestamp
                    this.peerHealthChecks.set(peerId, now)
                    // console.log(`Peer ${peerId} health check OK (${latency}ms)`)
                }
            } catch (error) {
                console.warn(`Peer ${peerId} health check failed:`, error)
                
                // Don't immediately remove, but don't update timestamp
                // Let the timeout mechanism handle it
            }
        }
    }
    
    // Get connection status including reconnection state
    getConnectionStatus() {
        if (this.isReconnecting) {
            return 'reconnecting'
        }
        
        if (!this.isConnected) {
            return 'disconnected'
        }
        
        return this.connectionStable ? 'stable' : 'connecting'
    }
    
    // Force reconnection (can be called manually)
    async forceReconnection() {
        if (!this.lastRoomConfig) {
            throw new Error('No room configuration available for reconnection')
        }
        
        console.log('Force reconnection initiated')
        
        this.reconnectionAttempts = 0 // Reset attempts
        await this.handleConnectionLoss()
    }
    
    // Force announce to all BitTorrent trackers for better peer discovery
    async forceAnnounceToTrackers() {
        if (!this.room) {
            console.warn('Cannot announce: no active room')
            return
        }
        
        try {
            // Get current relay sockets
            const relaySockets = this.trystero.getRelaySockets()
            console.log('Current tracker connections:', Object.keys(relaySockets))
            
            // Check which trackers are connected
            const connectedTrackers = []
            const disconnectedTrackers = []
            
            for (const [url, socket] of Object.entries(relaySockets)) {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    connectedTrackers.push(url)
                } else {
                    disconnectedTrackers.push(url)
                }
            }
            
            console.log(`Connected to ${connectedTrackers.length} trackers:`, connectedTrackers)
            if (disconnectedTrackers.length > 0) {
                console.warn(`Disconnected from ${disconnectedTrackers.length} trackers:`, disconnectedTrackers)
            }
            
            // Force peer discovery by triggering room actions
            if (this.sendUserInfo && this.identity && this.username) {
                console.log('Broadcasting presence to trigger peer discovery...')
                this.sendUserInfo({
                    username: this.username,
                    publicKey: this.identity.publicKey,
                    joinedAt: Date.now(),
                    announcement: true // Flag to indicate this is an announcement
                })
            }
            
            return {
                connectedTrackers: connectedTrackers.length,
                disconnectedTrackers: disconnectedTrackers.length,
                totalTrackers: Object.keys(relaySockets).length
            }
            
        } catch (error) {
            console.error('Failed to announce to trackers:', error)
            return null
        }
    }
    
    // Get detailed connection status for debugging
    getDetailedConnectionStatus() {
        if (!this.room || !this.trystero) {
            return {
                room: false,
                trackers: [],
                peers: 0,
                selfId: this.selfId
            }
        }
        
        try {
            const relaySockets = this.trystero.getRelaySockets()
            const trackerStatus = []
            
            for (const [url, socket] of Object.entries(relaySockets)) {
                trackerStatus.push({
                    url,
                    connected: socket && socket.readyState === WebSocket.OPEN,
                    readyState: socket ? socket.readyState : 'no-socket'
                })
            }
            
            const peers = this.getPeers()
            let peerCount = 0
            let peerIds = []
            
            if (peers && typeof peers.size === 'number') {
                // It's a Map
                peerCount = peers.size
                peerIds = Array.from(peers.keys())
            } else if (peers && typeof peers === 'object') {
                // It might be a plain object
                peerIds = Object.keys(peers)
                peerCount = peerIds.length
            }
            
            return {
                room: true,
                selfId: this.selfId,
                trackers: trackerStatus,
                peers: peerCount,
                peerIds: peerIds,
                connectedTrackers: trackerStatus.filter(t => t.connected).length,
                totalTrackers: trackerStatus.length
            }
            
        } catch (error) {
            console.error('Failed to get detailed connection status:', error)
            return {
                room: true,
                error: error.message,
                selfId: this.selfId
            }
        }
    }
}
