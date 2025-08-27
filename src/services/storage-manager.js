// Storage management for Pentagram.foo
// Handles localStorage operations with error handling

export class StorageManager {
    constructor() {
        this.prefix = 'pentagram-'
    }
    
    // Store data in localStorage
    store(key, data) {
        try {
            const fullKey = this.prefix + key
            const serialized = JSON.stringify(data)
            localStorage.setItem(fullKey, serialized)
            return true
        } catch (error) {
            console.error(`Failed to store ${key}:`, error)
            return false
        }
    }
    
    // Retrieve data from localStorage
    retrieve(key) {
        try {
            const fullKey = this.prefix + key
            const serialized = localStorage.getItem(fullKey)
            
            if (serialized === null) {
                return null
            }
            
            return JSON.parse(serialized)
        } catch (error) {
            console.error(`Failed to retrieve ${key}:`, error)
            return null
        }
    }
    
    // Remove data from localStorage
    remove(key) {
        try {
            const fullKey = this.prefix + key
            localStorage.removeItem(fullKey)
            return true
        } catch (error) {
            console.error(`Failed to remove ${key}:`, error)
            return false
        }
    }
    
    // Clear all Pentagram data
    clearAll() {
        try {
            const keysToRemove = []
            
            // Find all keys with our prefix
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith(this.prefix)) {
                    keysToRemove.push(key)
                }
            }
            
            // Remove all found keys
            keysToRemove.forEach(key => localStorage.removeItem(key))
            
            console.log(`Cleared ${keysToRemove.length} storage items`)
            return true
        } catch (error) {
            console.error('Failed to clear storage:', error)
            return false
        }
    }
    
    // Get storage usage info
    getStorageInfo() {
        try {
            let totalSize = 0
            let itemCount = 0
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith(this.prefix)) {
                    const value = localStorage.getItem(key)
                    totalSize += key.length + (value ? value.length : 0)
                    itemCount++
                }
            }
            
            return {
                itemCount,
                totalSize,
                approximateSizeKB: Math.round(totalSize / 1024 * 100) / 100
            }
        } catch (error) {
            console.error('Failed to get storage info:', error)
            return { itemCount: 0, totalSize: 0, approximateSizeKB: 0 }
        }
    }
    
    // Check if localStorage is available
    isAvailable() {
        try {
            const testKey = this.prefix + 'test'
            localStorage.setItem(testKey, 'test')
            localStorage.removeItem(testKey)
            return true
        } catch (error) {
            console.warn('localStorage not available:', error)
            return false
        }
    }
    
    // Backup all Pentagram data
    exportData() {
        try {
            const data = {}
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith(this.prefix)) {
                    const value = localStorage.getItem(key)
                    data[key] = value
                }
            }
            
            return {
                data,
                exported: Date.now(),
                version: '1.0'
            }
        } catch (error) {
            console.error('Failed to export data:', error)
            throw new Error('Data export failed')
        }
    }
    
    // Restore data from backup
    importData(backupData) {
        if (!backupData || !backupData.data) {
            throw new Error('Invalid backup data')
        }
        
        try {
            let imported = 0
            
            Object.entries(backupData.data).forEach(([key, value]) => {
                if (key.startsWith(this.prefix)) {
                    localStorage.setItem(key, value)
                    imported++
                }
            })
            
            console.log(`Imported ${imported} storage items`)
            return imported
        } catch (error) {
            console.error('Failed to import data:', error)
            throw new Error('Data import failed')
        }
    }
}