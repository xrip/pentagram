// Connection Status Component
document.addEventListener('alpine:init', () => {
    Alpine.data('connectionStatus', () => ({
        // Connection tracking
        trackers: [],
        connectionQuality: 'unknown', // unknown, poor, fair, good, excellent
        isReconnecting: false,
        lastUpdate: null,
        
        // Component initialization
        init() {
            console.log('Connection status component initialized')
            
            // Update connection status every 5 seconds
            this.updateInterval = setInterval(() => {
                this.updateConnectionStatus()
            }, 5000)
            
            // Initial update
            this.updateConnectionStatus()
        },
        
        // Update connection status with real tracker data
        updateConnectionStatus() {
            this.lastUpdate = Date.now()
            
            try {
                // Get app instance to access room manager
                const appElement = document.querySelector('[x-data="pentagramApp"]')
                if (appElement && appElement._x_dataStack) {
                    const app = appElement._x_dataStack[0]
                    
                    if (app && app.roomManager) {
                        // Get real tracker status
                        const trackerStatus = app.roomManager.getTrackerStatus()
                        this.trackers = trackerStatus
                        
                        if (app.connectionStatus === 'connected' && trackerStatus.length > 0) {
                            this.isReconnecting = false
                            this.assessConnectionQuality()
                        } else if (app.connectionStatus === 'connecting') {
                            this.isReconnecting = false
                            this.connectionQuality = 'poor'
                        } else if (app.connectionStatus === 'reconnecting') {
                            this.isReconnecting = true
                            this.connectionQuality = 'poor'
                        } else if (app.connectionStatus === 'stable') {
                            this.isReconnecting = false
                            this.connectionQuality = 'excellent'
                        } else {
                            this.isReconnecting = false
                            this.connectionQuality = 'unknown'
                        }
                    } else {
                        // No room manager or not connected
                        this.connectionQuality = 'unknown'
                        this.trackers = []
                    }
                }
            } catch (error) {
                console.warn('Failed to update connection status:', error)
                this.connectionQuality = 'unknown'
            }
        },
        
        // Assess connection quality based on tracker connections
        assessConnectionQuality() {
            if (!this.trackers.length) {
                this.connectionQuality = 'unknown'
                return
            }
            
            const connectedCount = this.trackers.filter(t => t.connected).length
            const totalCount = this.trackers.length
            const ratio = connectedCount / totalCount
            
            if (ratio >= 0.8) {
                this.connectionQuality = 'excellent'
            } else if (ratio >= 0.6) {
                this.connectionQuality = 'good'
            } else if (ratio >= 0.3) {
                this.connectionQuality = 'fair'
            } else {
                this.connectionQuality = 'poor'
            }
        },
        
        // Get connection quality color class
        get connectionColorClass() {
            const colors = {
                unknown: 'bg-gray-500',
                poor: this.isReconnecting ? 'bg-orange-500' : 'bg-red-500',
                fair: 'bg-yellow-500',
                good: 'bg-blue-500',
                excellent: 'bg-green-500'
            }
            return colors[this.connectionQuality] || colors.unknown
        },
        
        // Get connection status with reconnection context
        get connectionStatusClass() {
            return this.isReconnecting ? 'animate-pulse' : ''
        },
        
        // Get connection quality text
        get connectionText() {
            if (this.isReconnecting) {
                return 'Reconnecting...'
            }
            return this.connectionQuality.charAt(0).toUpperCase() + this.connectionQuality.slice(1)
        },
        
        // Component cleanup
        destroy() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval)
            }
        }
    }))
})