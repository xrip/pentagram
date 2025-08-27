// Room management with Trystero BitTorrent strategy
// Handles P2P room creation, joining, and peer communication

export class RoomManager {
    constructor() {
        this.room = null
        this.isConnected = false
        this.wakeLock = null
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
            
            // WebRTC configuration
            rtcConfig: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ]
            },
            turnConfig: {
                urls: ['turn:relay1.expressturn.com:3480'],
                username: '000000002071633131',
                credential: 'ca0MzQPfNpAFRA76TklRoOndCQQ='
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
        
        if (this.room) {
            console.warn('Already in a room, leaving first')
            this.leaveRoom()
        }
        
        try {
            const config = {
                ...this.config,
                password: password || null
            }
            
            console.log(`Joining room: ${roomId}`)
            console.log('Config:', { ...config, password: password ? '[HIDDEN]' : null })
            
            // Join room using Trystero BitTorrent strategy
            this.room = this.trystero.joinRoom(config, roomId)
            
            // Setup event handlers
            this.setupRoomEventHandlers()
            
            this.isConnected = true
            console.log('Room joined successfully')
            this.requestWakeLock()
            
            // Notify about connection status
            if (this.onConnectionStatusCallback) {
                this.onConnectionStatusCallback('connected')
            }
            
            return this.room
            
        } catch (error) {
            console.error('Failed to join room:', error)
            this.isConnected = false
            
            if (this.onConnectionStatusCallback) {
                this.onConnectionStatusCallback('failed')
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
            
            try {
                // Measure connection latency
                const latency = await this.room.ping(peerId)
                console.log(`P2P latency to ${peerId}: ${latency}ms`)
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
    
    // Leave the current room
    leaveRoom() {
        if (!this.room) return
        
        console.log('Leaving room...')
        
        try {
            this.room.leave()
            this.room = null
            this.isConnected = false
            this.releaseWakeLock()
            
            if (this.onConnectionStatusCallback) {
                this.onConnectionStatusCallback('disconnected')
            }
            
            console.log('Room left successfully')
        } catch (error) {
            console.error('Error leaving room:', error)
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
}