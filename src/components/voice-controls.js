// Voice Controls Component for Pentagram.foo
document.addEventListener('alpine:init', () => {
    Alpine.data('voiceControls', () => ({
        // Voice state
        isVoiceActive: false,
        isMuted: false,
        isSpeaking: false,
        currentVolume: 0,
        voiceError: null,
        
        // UI state
        showDeviceSelector: false,
        availableDevices: [],
        currentDevice: null,
        
        // Permission state
        permissionState: 'unknown', // unknown, granted, denied, prompt
        
        // Broadcasting state
        broadcastInterval: null,
        broadcastFrequency: 5000, // 5 seconds
        
        // Component initialization
        init() {
            console.log('Voice controls component initialized')
            
            // Get app instance to access audio manager
            this.setupAppConnection()
            
            // Check initial permission state
            this.checkMicrophonePermission()
            
            // Setup peer join listener for broadcasting voice status
            this.setupPeerJoinListener()
            
            // Start periodic voice status broadcasting
            this.startPeriodicBroadcasting()
        },
        
        // Setup connection to main app
        setupAppConnection() {
            const appElement = document.querySelector('[x-data*="pentagramApp"]')
            if (appElement && appElement._x_dataStack) {
                this.app = appElement._x_dataStack[0]
                
                // Setup audio manager callbacks if available
                if (this.app && this.app.audioManager) {
                    this.setupAudioCallbacks()
                }
                
                // Sync initial voice state with app
                this.syncVoiceStateWithApp()
            }
        },
        
        // Sync voice state with main app component
        syncVoiceStateWithApp() {
            if (!this.app) return
            
            this.app.isVoiceActive = this.isVoiceActive
            this.app.isMuted = this.isMuted
            this.app.isSpeaking = this.isSpeaking
        },
        
        // Setup audio manager callbacks
        setupAudioCallbacks() {
            const audioManager = this.app.audioManager
            
            // Volume and voice activity updates
            audioManager.onVolumeUpdate((data) => {
                this.currentVolume = data.volume
                this.isSpeaking = data.isSpeaking && !data.isMuted
                this.isMuted = data.isMuted
                
                // Sync voice state with main app
                this.syncVoiceStateWithApp()
                
                // Update voice activity in room if connected
                if (this.app.isConnected && data.speakingChanged) {
                    this.broadcastVoiceActivity()
                }
            })
            
            // Device change updates
            audioManager.onDeviceChange(async () => {
                await this.updateAvailableDevices()
            })
            
            // Error handling
            audioManager.onError((type, error) => {
                this.handleVoiceError(type, error)
            })
        },
        
        // Check microphone permission state
        async checkMicrophonePermission() {
            try {
                if (navigator.permissions) {
                    const permission = await navigator.permissions.query({ name: 'microphone' })
                    this.permissionState = permission.state
                    
                    permission.addEventListener('change', () => {
                        this.permissionState = permission.state
                    })
                }
            } catch (error) {
                console.warn('Could not check microphone permission:', error)
            }
        },
        
        // Toggle voice chat on/off
        async toggleVoice() {
            if (!this.app || !this.app.audioManager) {
                console.error('Audio manager not available')
                return
            }
            
            const audioManager = this.app.audioManager
            this.voiceError = null
            
            try {
                if (this.isVoiceActive) {
                    // Stop voice chat
                    audioManager.stopVoiceChat()
                    
                    // Remove stream from room
                    if (this.app.roomManager && this.app.roomManager.isRoomConnected()) {
                        this.app.roomManager.removeStream(audioManager.localStream)
                    }
                    
                    this.isVoiceActive = false
                    this.isMuted = false
                    this.isSpeaking = false
                    this.currentVolume = 0
                    
                    // Sync voice state with main app
                    this.syncVoiceStateWithApp()
                    
                    // Broadcast voice status change to all peers
                    this.broadcastVoiceActivity()
                    
                    console.log('Voice chat stopped')
                } else {
                    // Start voice chat
                    console.log('Starting voice chat...')
                    
                    const stream = await audioManager.startVoiceChat()
                    
                    // Add stream to room if connected
                    if (this.app.roomManager && this.app.roomManager.isRoomConnected()) {
                        this.app.roomManager.addStream(stream, null, {
                            type: 'audio',
                            username: this.app.username
                        })
                        console.log('Audio stream added to room')
                    }
                    
                    this.isVoiceActive = true
                    
                    // Sync voice state with main app
                    this.syncVoiceStateWithApp()
                    
                    // Update available devices
                    await this.updateAvailableDevices()
                    
                    // Broadcast voice status to all connected peers
                    this.broadcastVoiceActivity()
                    
                    console.log('Voice chat started')
                }
            } catch (error) {
                console.error('Voice toggle failed:', error)
                this.handleVoiceError('toggle', error)
            }
        },
        
        // Toggle microphone mute
        toggleMute() {
            if (!this.app || !this.app.audioManager || !this.isVoiceActive) {
                return
            }
            
            const wasOmuted = this.isMuted
            this.isMuted = this.app.audioManager.toggleMute()
            
            // Sync voice state with main app
            this.syncVoiceStateWithApp()
            
            // Broadcast mute state change
            if (wasOmuted !== this.isMuted) {
                this.broadcastVoiceActivity()
            }
            
            console.log(`Microphone ${this.isMuted ? 'muted' : 'unmuted'}`)
        },
        
        // Broadcast voice activity to peers
        broadcastVoiceActivity() {
            if (!this.app.isConnected || !this.app.sendVoiceStatus) return
            
            try {
                this.app.sendVoiceStatus({
                    isActive: this.isVoiceActive,
                    isMuted: this.isMuted,
                    isSpeaking: this.isSpeaking && !this.isMuted,
                    username: this.app.username,
                    timestamp: Date.now()
                })
            } catch (error) {
                console.warn('Failed to broadcast voice activity:', error)
            }
        },
        
        // Update available audio devices
        async updateAvailableDevices() {
            if (!this.app || !this.app.audioManager) return
            
            try {
                this.availableDevices = await this.app.audioManager.getAudioDevices()
                
                // Set current device if not set
                if (this.availableDevices.length > 0 && !this.currentDevice) {
                    this.currentDevice = this.availableDevices[0].deviceId
                }
            } catch (error) {
                console.error('Failed to update audio devices:', error)
            }
        },
        
        // Switch to different audio device
        async switchAudioDevice(deviceId) {
            if (!this.app || !this.app.audioManager) return
            
            try {
                const success = await this.app.audioManager.switchAudioDevice(deviceId)
                
                if (success) {
                    this.currentDevice = deviceId
                    this.showDeviceSelector = false
                    
                    // Update stream in room
                    if (this.app.roomManager && this.app.roomManager.isRoomConnected()) {
                        const stream = this.app.audioManager.localStream
                        
                        // Remove old stream and add new one
                        this.app.roomManager.removeStream(stream)
                        this.app.roomManager.addStream(stream, null, {
                            type: 'audio',
                            username: this.app.username
                        })
                    }
                }
            } catch (error) {
                console.error('Failed to switch audio device:', error)
                this.handleVoiceError('device_switch', error)
            }
        },
        
        // Handle voice errors
        handleVoiceError(type, error) {
            let errorMessage = 'Voice chat error'
            
            switch (type) {
                case 'permission_denied':
                    errorMessage = 'Microphone access denied. Please allow microphone access to use voice chat.'
                    this.permissionState = 'denied'
                    break
                case 'device_not_found':
                    errorMessage = 'No microphone found. Please connect a microphone to use voice chat.'
                    break
                case 'constraints_not_satisfied':
                    errorMessage = 'Microphone constraints not satisfied. Please try a different device.'
                    break
                case 'device_switch':
                    errorMessage = 'Failed to switch microphone device.'
                    break
                case 'toggle':
                    errorMessage = 'Failed to toggle voice chat.'
                    break
                default:
                    errorMessage = `Voice error: ${error.message || 'Unknown error'}`
            }
            
            this.voiceError = errorMessage
            console.error('Voice error:', type, error)
            
            // Clear error after 5 seconds
            setTimeout(() => {
                this.voiceError = null
            }, 5000)
        },
        
        // Get voice button icon based on state
        get voiceButtonIcon() {
            if (!this.isVoiceActive) {
                return '🎤'
            } else if (this.isMuted) {
                return '🎤🚫'
            } else if (this.isSpeaking) {
                return '🎤📢'
            } else {
                return '🎤✅'
            }
        },
        
        // Get voice button color class
        get voiceButtonColorClass() {
            if (!this.isVoiceActive) {
                return 'bg-gray-500 hover:bg-gray-600'
            } else if (this.isMuted) {
                return 'bg-red-500 hover:bg-red-600'
            } else if (this.isSpeaking) {
                return 'bg-green-500 hover:bg-green-600 animate-pulse'
            } else {
                return 'bg-blue-500 hover:bg-blue-600'
            }
        },
        
        // Get voice button title text
        get voiceButtonTitle() {
            if (!this.isVoiceActive) {
                return 'Start voice chat'
            } else if (this.isMuted) {
                return 'Unmute microphone'
            } else {
                return 'Mute microphone'
            }
        },
        
        // Get volume indicator bar width
        get volumeBarWidth() {
            return Math.min(100, Math.max(0, this.currentVolume * 2))
        },
        
        // Get device selector button text
        get deviceSelectorText() {
            if (!this.currentDevice) return 'Select Microphone'
            
            const device = this.availableDevices.find(d => d.deviceId === this.currentDevice)
            return device ? device.label : 'Unknown Device'
        },
        
        // Check if permission needs to be requested
        get needsPermission() {
            return this.permissionState === 'denied' || (!this.isVoiceActive && this.permissionState === 'prompt')
        },
        
        // Setup peer join listener to broadcast voice status to new peers
        setupPeerJoinListener() {
            // Wait a bit for app connection to be established
            setTimeout(() => {
                if (this.app && this.app.roomManager) {
                    // Hook into the existing peer join callback
                    const originalCallback = this.app.roomManager.onPeerJoinCallback
                    
                    this.app.roomManager.onPeerJoin((peerId) => {
                        // Call original callback first
                        if (originalCallback) {
                            originalCallback(peerId)
                        }
                        
                        // Broadcast current voice status to new peer
                        if (this.isVoiceActive) {
                            console.log(`Broadcasting voice status to new peer: ${peerId}`)
                            this.broadcastVoiceActivityToPeer(peerId)
                            
                            // Also ensure audio stream is sent to new peer
                            if (this.app.audioManager && this.app.audioManager.localStream) {
                                setTimeout(() => {
                                    this.app.roomManager.addStream(
                                        this.app.audioManager.localStream, 
                                        peerId, 
                                        {
                                            type: 'audio',
                                            username: this.app.username
                                        }
                                    )
                                    console.log(`Audio stream sent to new peer: ${peerId}`)
                                }, 100) // Small delay to ensure peer is ready
                            }
                        }
                    })
                }
            }, 500)
        },
        
        // Start periodic voice status broadcasting
        startPeriodicBroadcasting() {
            // Clear any existing interval
            if (this.broadcastInterval) {
                clearInterval(this.broadcastInterval)
            }
            
            this.broadcastInterval = setInterval(() => {
                if (this.isVoiceActive && this.app && this.app.isConnected) {
                    this.broadcastVoiceActivity()
                }
            }, this.broadcastFrequency)
            
            console.log('Periodic voice status broadcasting started')
        },
        
        // Broadcast voice activity to a specific peer
        broadcastVoiceActivityToPeer(peerId) {
            if (!this.app.isConnected || !this.app.sendVoiceStatus) return
            
            try {
                this.app.sendVoiceStatus({
                    isActive: this.isVoiceActive,
                    isMuted: this.isMuted,
                    isSpeaking: this.isSpeaking && !this.isMuted,
                    username: this.app.username,
                    timestamp: Date.now()
                }, peerId) // Send to specific peer
            } catch (error) {
                console.warn('Failed to broadcast voice activity to peer:', peerId, error)
            }
        },
        
        // Component cleanup
        destroy() {
            // Clear periodic broadcasting
            if (this.broadcastInterval) {
                clearInterval(this.broadcastInterval)
                this.broadcastInterval = null
            }
            
            // Stop voice chat
            if (this.isVoiceActive && this.app && this.app.audioManager) {
                this.app.audioManager.stopVoiceChat()
            }
        }
    }))
})