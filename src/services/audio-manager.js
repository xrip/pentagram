// Audio Manager for Voice Chat in Pentagram.foo
// Handles microphone access, audio streaming, and voice activity detection

export class AudioManager {
    constructor() {
        this.localStream = null
        this.audioContext = null
        this.analyser = null
        this.microphone = null
        this.isActive = false
        this.isMuted = false
        this.volumeCallback = null
        this.deviceChangeCallback = null
        this.errorCallback = null
        
        // Voice activity detection
        this.voiceThreshold = 30
        this.isSpeaking = false
        this.volumeHistory = []
        this.maxVolumeHistory = 10
        
        // Audio constraints
        this.audioConstraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100,
                channelCount: 1
            },
            video: false
        }
        
        // Bind methods
        this.handleDeviceChange = this.handleDeviceChange.bind(this)
    }
    
    // Initialize audio manager
    async init() {
        try {
            // Check if audio devices are available
            const devices = await navigator.mediaDevices.enumerateDevices()
            const audioInputs = devices.filter(device => device.kind === 'audioinput')
            
            if (audioInputs.length === 0) {
                throw new Error('No audio input devices found')
            }
            
            console.log('Audio Manager initialized')
            console.log(`Found ${audioInputs.length} audio input device(s)`)
            
            // Listen for device changes
            navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange)
            
            return true
        } catch (error) {
            console.error('Failed to initialize Audio Manager:', error)
            if (this.errorCallback) {
                this.errorCallback('initialization', error)
            }
            throw error
        }
    }
    
    // Request microphone access and create audio stream
    async startVoiceChat() {
        if (this.isActive) {
            console.warn('Voice chat is already active')
            return this.localStream
        }
        
        try {
            console.log('Requesting microphone access...')
            
            // Request microphone permission
            this.localStream = await navigator.mediaDevices.getUserMedia(this.audioConstraints)
            
            console.log('Microphone access granted')
            console.log('Stream ID:', this.localStream.id)
            console.log('Audio tracks:', this.localStream.getAudioTracks().length)
            
            // Setup audio analysis for voice activity detection
            await this.setupAudioAnalysis()
            
            this.isActive = true
            
            return this.localStream
        } catch (error) {
            console.error('Failed to access microphone:', error)
            
            if (this.errorCallback) {
                let errorType = 'unknown'
                if (error.name === 'NotAllowedError') {
                    errorType = 'permission_denied'
                } else if (error.name === 'NotFoundError') {
                    errorType = 'device_not_found'
                } else if (error.name === 'OverconstrainedError') {
                    errorType = 'constraints_not_satisfied'
                }
                this.errorCallback(errorType, error)
            }
            
            throw error
        }
    }
    
    // Setup audio analysis for voice activity detection
    async setupAudioAnalysis() {
        if (!this.localStream) return
        
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
            
            // Create microphone source
            this.microphone = this.audioContext.createMediaStreamSource(this.localStream)
            
            // Create analyser for volume detection
            this.analyser = this.audioContext.createAnalyser()
            this.analyser.fftSize = 512
            this.analyser.smoothingTimeConstant = 0.3
            
            // Connect microphone to analyser
            this.microphone.connect(this.analyser)
            
            console.log('Audio analysis setup complete')
            
            // Start monitoring voice activity
            this.startVoiceActivityDetection()
        } catch (error) {
            console.error('Failed to setup audio analysis:', error)
        }
    }
    
    // Start voice activity detection loop
    startVoiceActivityDetection() {
        if (!this.analyser) return
        
        const bufferLength = this.analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        
        const detectActivity = () => {
            if (!this.isActive || !this.analyser) return
            
            // Get frequency data
            this.analyser.getByteFrequencyData(dataArray)
            
            // Calculate average volume
            const volume = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength
            
            // Update volume history for smoothing
            this.volumeHistory.push(volume)
            if (this.volumeHistory.length > this.maxVolumeHistory) {
                this.volumeHistory.shift()
            }
            
            // Calculate smoothed volume
            const smoothedVolume = this.volumeHistory.reduce((sum, vol) => sum + vol, 0) / this.volumeHistory.length
            
            // Determine if speaking
            const wasSpeaking = this.isSpeaking
            this.isSpeaking = smoothedVolume > this.voiceThreshold
            
            // Call volume callback with current data
            if (this.volumeCallback) {
                this.volumeCallback({
                    volume: Math.round(smoothedVolume),
                    isSpeaking: this.isSpeaking,
                    isMuted: this.isMuted,
                    speakingChanged: wasSpeaking !== this.isSpeaking
                })
            }
            
            // Continue monitoring
            requestAnimationFrame(detectActivity)
        }
        
        detectActivity()
    }
    
    // Stop voice chat and clean up resources
    stopVoiceChat() {
        console.log('Stopping voice chat...')
        
        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop()
                console.log('Stopped audio track:', track.id)
            })
            this.localStream = null
        }
        
        // Close audio context
        if (this.audioContext) {
            this.audioContext.close().catch(err => {
                console.warn('Error closing audio context:', err)
            })
            this.audioContext = null
        }
        
        // Reset state
        this.analyser = null
        this.microphone = null
        this.isActive = false
        this.isMuted = false
        this.isSpeaking = false
        this.volumeHistory = []
        
        console.log('Voice chat stopped')
    }
    
    // Toggle microphone mute state
    toggleMute() {
        if (!this.localStream) {
            console.warn('Cannot toggle mute: no active stream')
            return false
        }
        
        const audioTracks = this.localStream.getAudioTracks()
        if (audioTracks.length === 0) {
            console.warn('Cannot toggle mute: no audio tracks')
            return false
        }
        
        this.isMuted = !this.isMuted
        
        audioTracks.forEach(track => {
            track.enabled = !this.isMuted
        })
        
        console.log(`Microphone ${this.isMuted ? 'muted' : 'unmuted'}`)
        
        return this.isMuted
    }
    
    // Set microphone mute state
    setMuted(muted) {
        if (!this.localStream) return false
        
        const audioTracks = this.localStream.getAudioTracks()
        if (audioTracks.length === 0) return false
        
        this.isMuted = muted
        
        audioTracks.forEach(track => {
            track.enabled = !this.isMuted
        })
        
        console.log(`Microphone ${this.isMuted ? 'muted' : 'unmuted'}`)
        
        return this.isMuted
    }
    
    // Get current audio devices
    async getAudioDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const audioInputs = devices.filter(device => device.kind === 'audioinput')
            
            return audioInputs.map(device => ({
                deviceId: device.deviceId,
                label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
                groupId: device.groupId
            }))
        } catch (error) {
            console.error('Failed to get audio devices:', error)
            return []
        }
    }
    
    // Switch to a different audio device
    async switchAudioDevice(deviceId) {
        if (!this.isActive) {
            console.warn('Cannot switch device: voice chat not active')
            return false
        }
        
        try {
            console.log('Switching to audio device:', deviceId)
            
            // Stop current stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop())
            }
            
            // Create new stream with specified device
            const constraints = {
                ...this.audioConstraints,
                audio: {
                    ...this.audioConstraints.audio,
                    deviceId: { exact: deviceId }
                }
            }
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
            
            // Re-setup audio analysis
            await this.setupAudioAnalysis()
            
            console.log('Successfully switched audio device')
            return true
        } catch (error) {
            console.error('Failed to switch audio device:', error)
            if (this.errorCallback) {
                this.errorCallback('device_switch', error)
            }
            return false
        }
    }
    
    // Handle device change events
    handleDeviceChange() {
        console.log('Audio devices changed')
        if (this.deviceChangeCallback) {
            this.deviceChangeCallback()
        }
    }
    
    // Set volume threshold for voice activity detection
    setVoiceThreshold(threshold) {
        this.voiceThreshold = Math.max(0, Math.min(100, threshold))
        console.log('Voice threshold set to:', this.voiceThreshold)
    }
    
    // Event callbacks
    onVolumeUpdate(callback) {
        this.volumeCallback = callback
    }
    
    onDeviceChange(callback) {
        this.deviceChangeCallback = callback
    }
    
    onError(callback) {
        this.errorCallback = callback
    }
    
    // Get current status
    getStatus() {
        return {
            isActive: this.isActive,
            isMuted: this.isMuted,
            isSpeaking: this.isSpeaking,
            hasStream: !!this.localStream,
            hasAudioContext: !!this.audioContext,
            trackCount: this.localStream?.getAudioTracks().length || 0
        }
    }
    
    // Cleanup method
    destroy() {
        console.log('Destroying Audio Manager...')
        
        // Remove event listeners
        if (navigator.mediaDevices) {
            navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange)
        }
        
        // Stop voice chat
        this.stopVoiceChat()
        
        // Clear callbacks
        this.volumeCallback = null
        this.deviceChangeCallback = null
        this.errorCallback = null
        
        console.log('Audio Manager destroyed')
    }
}