// Main Pentagram App Component
document.addEventListener('alpine:init', () => {
    Alpine.data('pentagramApp', () => ({
        // Persisted state (uses Alpine.persist)
        username: Alpine.$persist('').as('pentagram-username'),
        identity: Alpine.$persist(null).as('pentagram-identity'),
        recentRooms: Alpine.$persist([]).as('pentagram-recent-rooms'),
        
        // Session state
        roomId: '',
        roomPassword: '',
        isConnected: false,
        connectionStatus: 'disconnected', // disconnected, connecting, connected, reconnecting, stable
        peers: new Map(),
        messages: [],
        messageInput: '',
        
        // Voice state (synced with voice-controls component)
        isVoiceActive: false,
        isMuted: false,
        isSpeaking: false,
        
        // Services
        roomManager: null,
        cryptoManager: null,
        storageManager: null,
        audioManager: null,
        
        // Peer discovery and health monitoring
        announcementTimer: null,
        announcementInterval: 30000, // Announce every 30 seconds
        peerPingTimer: null,
        peerPingInterval: 15000, // Ping peers every 15 seconds
        
        // Notification system
        notification: {
            show: false,
            message: ''
        },
        
        // Trystero actions (will be set when room is joined)
        sendMessage: null,
        sendUserInfo: null,
        sendTyping: null,
        sendVoiceStatus: null,
        sendPing: null,
        sendPong: null,
        
        // Component initialization
        async init() {
            console.log('Pentagram.foo initializing...')
            
            // Initialize services
            await this.initializeServices()
            
            // Initialize or load identity
            await this.initializeIdentity()
            
            // Load room from URL if present
            this.loadRoomFromURL()

            // Handle shared data
            this.handleSharedData()
            
            console.log('Initialization complete')
            console.log('Username:', this.username)
            console.log('Room ID from URL:', this.roomId)
            console.log('Identity:', this.identity ? 'loaded' : 'none')
            
            // Show welcome notification
            if (!this.username) {
                this.showNotification('Welcome to Pentagram.foo! Choose a username to get started.')
            }
        },
        
        // Initialize all services
        async initializeServices() {
            try {
                // Import and initialize services
                const { CryptoManager } = await import('../services/crypto-utils.js')
                const { StorageManager } = await import('../services/storage-manager.js')
                const { RoomManager } = await import('../services/room-manager.js')
                const { AudioManager } = await import('../services/audio-manager.js')
                
                this.cryptoManager = new CryptoManager()
                this.storageManager = new StorageManager()
                this.roomManager = new RoomManager()
                this.audioManager = new AudioManager()
                
                // Initialize audio manager
                await this.audioManager.init()
                
                // Setup room manager callbacks
                this.setupRoomManagerCallbacks()
                
                console.log('Services initialized')
            } catch (error) {
                console.error('Failed to initialize services:', error)
                this.showNotification('Failed to initialize services', 5000)
            }
        },
        
        // Setup room manager event callbacks
        setupRoomManagerCallbacks() {
            if (!this.roomManager) return
            
            this.roomManager.onPeerJoin((peerId) => {
                console.log('App: Peer joined:', peerId)
                
                // Add peer to our peers map
                this.peers.set(peerId, {
                    id: peerId,
                    username: null,
                    publicKey: null,
                    joinedAt: Date.now(),
                    lastSeen: Date.now(),
                    responsive: true,
                    latency: null,
                    isTyping: false
                })
                
                // Send our user info to the new peer
                if (this.sendUserInfo) {
                    this.sendUserInfo({
                        username: this.username,
                        publicKey: this.identity.publicKey,
                        joinedAt: Date.now()
                    }, peerId)
                }
                
                // Send audio stream to new peer if voice chat is active
                if (this.audioManager && this.audioManager.localStream && this.audioManager.isActive) {
                    console.log(`Sending audio stream to new peer: ${peerId}`)
                    setTimeout(() => {
                        this.roomManager.addStream(this.audioManager.localStream, peerId, {
                            type: 'audio',
                            username: this.username
                        })
                    }, 100) // Small delay to ensure peer is ready
                }
            })
            
            this.roomManager.onPeerLeave((peerId) => {
                console.log('App: Peer left:', peerId)
                this.peers.delete(peerId)
            })
            
            this.roomManager.onConnectionStatus((status) => {
                console.log('App: Connection status changed:', status)
                const wasReconnecting = this.connectionStatus === 'reconnecting'
                
                if (status === 'connected') {
                    this.isConnected = true
                    this.connectionStatus = 'connected'
                    // Show recovery notification if we were reconnecting
                    if (wasReconnecting) {
                        this.showNotification('Connection restored!')
                    }
                } else if (status === 'disconnected') {
                    this.isConnected = false
                    this.connectionStatus = 'disconnected'
                    this.peers.clear()
                    this.messages = []
                } else if (status === 'reconnecting') {
                    this.isConnected = false
                    this.connectionStatus = 'reconnecting'
                    this.showNotification('Reconnecting...', 0) // No timeout for reconnecting notification
                } else if (status === 'stable') {
                    this.connectionStatus = 'stable'
                    this.showNotification('Connection is stable', 2000)
                } else if (status === 'failed') {
                    this.connectionStatus = 'disconnected'
                    this.showNotification('Failed to connect to P2P network', 5000)
                }
            })
            
            // Handle reconnection - re-announce client presence
            this.roomManager.onReconnected(() => {
                console.log('App: Reconnected - re-announcing presence')
                this.reannouncePresence()
            })
        },
        
        // Initialize or load cryptographic identity
        async initializeIdentity() {
            if (!this.cryptoManager) {
                console.warn('CryptoManager not available')
                return
            }
            
            try {
                if (this.identity) {
                    // Load existing identity
                    console.log('Loading existing identity...')
                    await this.cryptoManager.loadKeyPair(this.identity)
                    console.log('Identity loaded:', this.cryptoManager.getPublicKeyFingerprint())
                } else {
                    // Generate new identity
                    console.log('Generating new identity...')
                    const keyPair = await this.cryptoManager.generateKeyPair()
                    
                    // Store identity
                    this.identity = {
                        publicKey: Array.from(keyPair.publicKey),
                        privateKey: Array.from(keyPair.privateKey),
                        created: keyPair.created
                    }
                    
                    console.log('New identity created:', this.cryptoManager.getPublicKeyFingerprint())
                    this.showNotification('New cryptographic identity created', 3000)
                }
            } catch (error) {
                console.error('Identity initialization failed:', error)
                this.showNotification('Failed to initialize identity', 5000)
            }
        },
        
        // Load room information from URL hash
        loadRoomFromURL() {
            const hash = window.location.hash
            const match = hash.match(/#\/room\/([^?]+)(\?password=(.+))?/)
            
            if (match) {
                this.roomId = decodeURIComponent(match[1])
                this.roomPassword = match[3] ? decodeURIComponent(match[3]) : ''
                console.log(`Room loaded from URL: ${this.roomId}`)
            }
        },

        // Handle shared data from PWA share target
        handleSharedData() {
            const query = new URLSearchParams(window.location.search);
            const sharedUrl = query.get('url') || query.get('text') || query.get('title');

            if (sharedUrl) {
                try {
                    const url = new URL(sharedUrl);
                    const hash = url.hash;
                    const match = hash.match(/#\/room\/([^?]+)(\?password=(.+))?/);

                    if (match) {
                        this.roomId = decodeURIComponent(match[1]);
                        this.roomPassword = match[3] ? decodeURIComponent(match[3]) : '';
                        console.log(`Room loaded from shared URL: ${this.roomId}`);
                        this.showNotification('Room link loaded from share.', 3000);
                    }
                } catch (error) {
                    console.warn('Could not parse shared URL:', error);
                }
            }
        },
        
        // Join room with real P2P functionality
        async joinRoom() {
            if (!this.username.trim() || !this.roomId.trim()) {
                this.showNotification('Please enter both username and room name')
                return false
            }
            
            if (!this.roomManager || !this.cryptoManager) {
                this.showNotification('Services not ready, please wait...')
                return false
            }
            
            console.log(`Attempting to join room: ${this.roomId} as ${this.username}`)
            this.connectionStatus = 'connecting'
            
            try {
                // Join room via Trystero
                const room = await this.roomManager.joinRoom(
                    this.roomId,
                    this.roomPassword || null,
                    (error) => {
                        console.error('Room join error:', error)
                        this.showNotification('Failed to join room: ' + error.message)
                        this.connectionStatus = 'disconnected'
                    }
                )
                
                // Setup communication actions
                this.setupCommunicationActions(room)
                
                // Set user info in room manager for announcements
                if (this.roomManager && this.sendUserInfo) {
                    this.roomManager.setUserInfo(this.username, this.identity, this.sendUserInfo)
                }
                
                // Connection successful
                this.isConnected = true
                this.connectionStatus = 'connected'
                
                // Add to recent rooms
                this.addToRecentRooms()
                
                // Update URL
                this.updateURL()
                
                this.showNotification(`Connected to room: ${this.roomId}`)
                console.log('Room joined successfully')
                
                // Start periodic announcements and peer pinging
                this.startPeriodicAnnouncements()
                this.startPeerPinging()
                
                return true
                
            } catch (error) {
                console.error('Failed to join room:', error)
                this.connectionStatus = 'disconnected'
                this.showNotification('Failed to connect to P2P network')
                return false
            }
        },
        
        // Setup communication actions with peers
        setupCommunicationActions(room) {
            try {
                // Chat messaging
                const [sendMsg, getMsg] = room.makeAction('message')
                this.sendMessage = sendMsg
                
                getMsg((message, peerId) => {
                    this.handleIncomingMessage(message, peerId)
                })
                
                // User information exchange
                const [sendUser, getUser] = room.makeAction('userInfo')
                this.sendUserInfo = sendUser
                
                getUser((userInfo, peerId) => {
                    this.handleUserInfo(userInfo, peerId)
                })
                
                // Typing indicators
                const [sendType, getType] = room.makeAction('typing')
                this.sendTyping = sendType
                
                getType((isTyping, peerId) => {
                    this.handleTypingStatus(isTyping, peerId)
                })
                
                // Voice status communication
                const [sendVoice, getVoice] = room.makeAction('voiceStatus')
                this.sendVoiceStatus = sendVoice
                
                getVoice((voiceStatus, peerId) => {
                    this.handleVoiceStatus(voiceStatus, peerId)
                })
                
                // Peer health monitoring - ping/pong
                const [sendPing, getPing] = room.makeAction('ping')
                const [sendPong, getPong] = room.makeAction('pong')
                this.sendPing = sendPing
                this.sendPong = sendPong
                
                // Handle incoming pings - respond with pong
                getPing((pingData, peerId) => {
                    this.handlePeerPing(pingData, peerId)
                })
                
                // Handle incoming pongs - update peer health
                getPong((pongData, peerId) => {
                    this.handlePeerPong(pongData, peerId)
                })
                
                console.log('Communication actions setup complete')
                
            } catch (error) {
                console.error('Failed to setup communication actions:', error)
                this.showNotification('Failed to setup peer communication')
            }
        },
        
        // Handle incoming chat messages
        async handleIncomingMessage(message, peerId) {
            try {
                // Verify message signature
                const peer = this.peers.get(peerId)
                if (!peer?.publicKey) {
                    console.warn('Received message from unknown peer:', peerId)
                    return
                }
                
                const isValid = await this.cryptoManager.verifyMessage(
                    message.content,
                    message.signature,
                    peer.publicKey
                )
                
                if (!isValid) {
                    console.warn('Invalid message signature from:', peerId)
                    return
                }
                
                // Add verified message
                this.messages.push({
                    id: message.id,
                    content: message.content,
                    username: peer.username || peerId.substring(0, 8),
                    peerId,
                    timestamp: message.timestamp,
                    verified: true,
                    self: false
                })
                
                // Auto-scroll to bottom
                this.$nextTick(() => {
                    const container = document.getElementById('messages-container')
                    if (container) {
                        container.scrollTop = container.scrollHeight
                    }
                })
                
            } catch (error) {
                console.error('Failed to handle incoming message:', error)
            }
        },
        
        // Handle peer user information
        handleUserInfo(userInfo, peerId) {
            const peer = this.peers.get(peerId)
            if (peer) {
                peer.username = userInfo.username
                peer.publicKey = userInfo.publicKey
                peer.lastSeen = Date.now()
                this.peers.set(peerId, peer)
                
                console.log(`Updated peer info for ${peerId}: ${userInfo.username}`)
            }
        },
        
        // Handle incoming ping from peer
        handlePeerPing(pingData, peerId) {
            if (this.sendPong) {
                // Respond with pong including our current status
                this.sendPong({
                    id: pingData.id,
                    timestamp: Date.now(),
                    username: this.username,
                    status: 'active'
                }, peerId)
                
                // Update peer's last seen time
                const peer = this.peers.get(peerId)
                if (peer) {
                    peer.lastSeen = Date.now()
                    peer.responsive = true
                    this.peers.set(peerId, peer)
                }
                
                console.log(`Received ping from ${peer?.username || peerId}, sent pong`)
            }
        },
        
        // Handle incoming pong from peer
        handlePeerPong(pongData, peerId) {
            const peer = this.peers.get(peerId)
            if (peer) {
                const roundTripTime = Date.now() - pongData.timestamp
                peer.lastSeen = Date.now()
                peer.responsive = true
                peer.latency = roundTripTime
                this.peers.set(peerId, peer)
                
                console.log(`Received pong from ${peer.username || peerId}, RTT: ${roundTripTime}ms`)
            }
        },
        
        // Handle typing status
        handleTypingStatus(isTyping, peerId) {
            const peer = this.peers.get(peerId)
            if (peer) {
                peer.isTyping = isTyping
                this.peers.set(peerId, peer)
            }
        },
        
        // Handle voice status updates
        handleVoiceStatus(voiceStatus, peerId) {
            const peer = this.peers.get(peerId)
            if (peer) {
                peer.voiceStatus = {
                    isActive: voiceStatus.isActive || false,
                    isMuted: voiceStatus.isMuted || false,
                    isSpeaking: voiceStatus.isSpeaking || false,
                    lastUpdate: Date.now()
                }
                this.peers.set(peerId, peer)
                
                console.log(`Voice status update for ${peer.username || peerId}:`, peer.voiceStatus)
            }
        },
        
        // Leave current room
        async leaveRoom() {
            console.log('Leaving room...')
            
            // Leave P2P room with proper cleanup
            if (this.roomManager) {
                await this.roomManager.leaveRoom()
            }
            
            // Reset state
            this.isConnected = false
            this.connectionStatus = 'disconnected'
            this.peers.clear()
            this.messages = []
            this.roomId = ''
            this.roomPassword = ''
            
            // Clear action handlers
            this.sendMessage = null
            this.sendUserInfo = null
            this.sendTyping = null
            this.sendVoiceStatus = null
            this.sendPing = null
            this.sendPong = null
            
            // Stop periodic announcements and peer pings
            this.stopPeriodicAnnouncements()
            this.stopPeerPinging()
            
            // Update URL
            window.history.replaceState({}, '', window.location.pathname)
            
            this.showNotification('Left room')
        },
        
        // Send chat message with P2P and crypto
        async sendChatMessage(content) {
            if (!content || !content.trim()) return
            
            if (!this.isConnected || !this.sendMessage || !this.cryptoManager) {
                this.showNotification('Not connected to room')
                return
            }
            
            try {
                const messageText = content.trim()
                
                // Sign the message
                const signature = await this.cryptoManager.signMessage(messageText)
                
                // Create message object
                const message = {
                    id: crypto.randomUUID(),
                    content: messageText,
                    username: this.username,
                    timestamp: Date.now(),
                    signature: Array.from(signature) // Convert to array for transmission
                }
                
                // Send to all peers
                await this.sendMessage(message)
                
                // Add to our own message list
                this.messages.push({
                    ...message,
                    peerId: 'self',
                    verified: true,
                    self: true
                })
                
                console.log('Message sent:', messageText)
                
                // Auto-scroll to bottom
                this.$nextTick(() => {
                    const container = document.getElementById('messages-container')
                    if (container) {
                        container.scrollTop = container.scrollHeight
                    }
                })
                
            } catch (error) {
                console.error('Failed to send message:', error)
                this.showNotification('Failed to send message')
            }
        },
        
        // Handle typing indicator (stub)
        handleTyping() {
            // Will implement typing indicators in later phases
            console.log('User is typing...')
        },
        
        // Copy room link to clipboard
        async copyRoomLink() {
            const link = this.getRoomShareLink()
            
            try {
                await navigator.clipboard.writeText(link)
                this.showNotification('Room link copied to clipboard!')
            } catch (err) {
                console.error('Failed to copy link:', err)
                this.showNotification('Failed to copy link')
            }
        },
        
        // Generate shareable room link
        getRoomShareLink() {
            if (!this.roomId) return ''
            
            const baseUrl = `${window.location.origin}${window.location.pathname}#/room/${encodeURIComponent(this.roomId)}`
            return this.roomPassword 
                ? `${baseUrl}?password=${encodeURIComponent(this.roomPassword)}` 
                : baseUrl
        },
        
        // Add room to recent rooms list
        addToRecentRooms() {
            const room = {
                id: this.roomId,
                name: this.roomId,
                lastVisited: Date.now(),
                hasPassword: !!this.roomPassword
            }
            
            // Remove if already exists
            this.recentRooms = this.recentRooms.filter(r => r.id !== this.roomId)
            
            // Add to front
            this.recentRooms.unshift(room)
            
            // Keep only last 10
            if (this.recentRooms.length > 10) {
                this.recentRooms = this.recentRooms.slice(0, 10)
            }
        },
        
        // Update browser URL
        updateURL() {
            if (!this.roomId) return
            
            const baseUrl = `${window.location.origin}${window.location.pathname}#/room/${encodeURIComponent(this.roomId)}`
            const url = this.roomPassword 
                ? `${baseUrl}?password=${encodeURIComponent(this.roomPassword)}` 
                : baseUrl
                
            window.history.replaceState({}, '', url)
        },
        
        // Show notification
        showNotification(message, duration = 3000) {
            this.notification.message = message
            this.notification.show = true
            
            setTimeout(() => {
                this.notification.show = false
            }, duration)
        },
        
        // Export identity for backup
        exportIdentity() {
            if (!this.cryptoManager || !this.username) {
                this.showNotification('No identity to export')
                return
            }
            
            try {
                const exportData = this.cryptoManager.exportIdentity(this.username)
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                    type: 'application/json' 
                })
                
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `pentagram-identity-${this.username}-${Date.now()}.json`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                
                this.showNotification('Identity exported successfully')
            } catch (error) {
                console.error('Export failed:', error)
                this.showNotification('Failed to export identity')
            }
        },
        
        // Import identity from file
        async importIdentity(file) {
            if (!this.cryptoManager) {
                this.showNotification('Crypto services not available')
                return
            }
            
            try {
                const text = await file.text()
                const importData = JSON.parse(text)
                
                const username = await this.cryptoManager.importIdentity(importData)
                
                if (username) {
                    this.username = username
                }
                
                // Update stored identity
                this.identity = importData.identity
                
                this.showNotification('Identity imported successfully')
                console.log('Identity imported:', this.cryptoManager.getPublicKeyFingerprint())
            } catch (error) {
                console.error('Import failed:', error)
                this.showNotification('Failed to import identity')
            }
        },
        
        // Clear all data and generate new identity
        async clearData() {
            if (!confirm('This will delete all your data including your identity. Are you sure?')) {
                return
            }
            
            try {
                // Clear Alpine persist data
                this.username = ''
                this.identity = null
                this.recentRooms = []
                
                // Clear storage
                if (this.storageManager) {
                    this.storageManager.clearAll()
                }
                
                // Clear crypto manager
                this.cryptoManager = null
                
                // Reinitialize
                await this.initializeServices()
                await this.initializeIdentity()
                
                this.showNotification('All data cleared, new identity created')
            } catch (error) {
                console.error('Failed to clear data:', error)
                this.showNotification('Failed to clear data')
            }
        },
        
        // Re-announce presence after reconnection to restore peer visibility
        reannouncePresence() {
            if (!this.sendUserInfo || !this.identity || !this.username) {
                console.warn('Cannot re-announce: missing sendUserInfo, identity, or username')
                return
            }
            
            try {
                // Broadcast our user info to all current peers
                this.sendUserInfo({
                    username: this.username,
                    publicKey: this.identity.publicKey,
                    joinedAt: Date.now(),
                    reconnected: true // Flag to indicate this is a re-announcement
                })
                
                console.log('Re-announced presence to all peers after reconnection')
                this.showNotification('Restored visibility to other users', 2000)
                
            } catch (error) {
                console.error('Failed to re-announce presence:', error)
            }
        },
        
        // Get identity information for display
        getIdentityInfo() {
            if (!this.cryptoManager || !this.identity) {
                return null
            }
            
            return {
                fingerprint: this.cryptoManager.getPublicKeyFingerprint(),
                userId: this.cryptoManager.getUserId(),
                publicKeyHex: this.cryptoManager.getPublicKeyHex(),
                created: this.identity.created ? new Date(this.identity.created).toLocaleString() : 'Unknown'
            }
        },
        
        // Start periodic announcements to improve peer discovery
        startPeriodicAnnouncements() {
            if (this.announcementTimer) {
                clearInterval(this.announcementTimer)
            }
            
            console.log('Starting periodic peer discovery announcements')
            
            this.announcementTimer = setInterval(async () => {
                if (this.isConnected && this.roomManager) {
                    try {
                        // Force announce to all trackers
                        const status = await this.roomManager.forceAnnounceToTrackers()
                        if (status) {
                            console.log(`Announced to ${status.connectedTrackers}/${status.totalTrackers} trackers`)
                        }
                        
                        // Get detailed connection status for debugging
                        const detailedStatus = this.roomManager.getDetailedConnectionStatus()
                        console.log('Peer discovery status:', detailedStatus)
                        
                        // If we have no peers after a while, show helpful message
                        if (detailedStatus.peers === 0 && detailedStatus.connectedTrackers > 0) {
                            console.log('No peers found yet, but connected to trackers. Waiting for peer discovery...')
                        }
                        
                    } catch (error) {
                        console.error('Periodic announcement failed:', error)
                    }
                }
            }, this.announcementInterval)
            
            // Also do an immediate announcement
            if (this.roomManager && this.isConnected) {
                setTimeout(() => {
                    this.roomManager.forceAnnounceToTrackers()
                }, 2000) // Wait 2 seconds after joining
            }
        },
        
        // Stop periodic announcements
        stopPeriodicAnnouncements() {
            if (this.announcementTimer) {
                clearInterval(this.announcementTimer)
                this.announcementTimer = null
                console.log('Stopped periodic announcements')
            }
        },
        
        // Start periodic peer pinging for health monitoring
        startPeerPinging() {
            if (this.peerPingTimer) {
                clearInterval(this.peerPingTimer)
            }
            
            console.log('Starting periodic peer pinging')
            
            this.peerPingTimer = setInterval(() => {
                if (this.isConnected && this.sendPing && this.peers.size > 0) {
                    // Ping all connected peers
                    for (const [peerId, peer] of this.peers) {
                        if (peerId !== 'self') {
                            const pingId = crypto.randomUUID()
                            const pingData = {
                                id: pingId,
                                timestamp: Date.now(),
                                username: this.username
                            }
                            
                            this.sendPing(pingData, peerId)
                            console.log(`Sent ping to ${peer.username || peerId}`)
                            
                            // Mark peer as potentially unresponsive if no recent activity
                            const timeSinceLastSeen = Date.now() - (peer.lastSeen || 0)
                            if (timeSinceLastSeen > 60000) { // 1 minute
                                peer.responsive = false
                                this.peers.set(peerId, peer)
                                console.warn(`Peer ${peer.username || peerId} may be unresponsive (${Math.round(timeSinceLastSeen/1000)}s since last seen)`)
                            }
                        }
                    }
                }
            }, this.peerPingInterval)
        },
        
        // Stop peer pinging
        stopPeerPinging() {
            if (this.peerPingTimer) {
                clearInterval(this.peerPingTimer)
                this.peerPingTimer = null
                console.log('Stopped peer pinging')
            }
        },
        
        // Debug method to get connection status
        getConnectionDebugInfo() {
            if (!this.roomManager) {
                return 'Room manager not available'
            }
            
            const status = this.roomManager.getDetailedConnectionStatus()
            console.log('=== CONNECTION DEBUG INFO ===')
            console.log('Self ID:', status.selfId)
            console.log('Connected to room:', status.room)
            console.log('Peers found:', status.peers)
            console.log('Peer IDs:', status.peerIds)
            console.log('Tracker connections:', status.connectedTrackers + '/' + status.totalTrackers)
            console.log('Trackers:', status.trackers)
            console.log('===============================')
            
            return status
        }
    }))
})