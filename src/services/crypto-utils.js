// Cryptographic utilities for Pentagram.foo
// Using @noble/ed25519 for Ed25519 signatures

export class CryptoManager {
    constructor() {
        this.keyPair = null
        this.ed25519 = null
        this.initialized = false
    }
    
    // Initialize the crypto library
    async init() {
        if (this.initialized) return
        
        try {
            // Dynamic import of @noble/ed25519 from CDN
            this.ed25519 = await import('https://cdn.jsdelivr.net/npm/@noble/ed25519@2.0.0/+esm')
            this.initialized = true
            console.log('CryptoManager initialized with @noble/ed25519')
        } catch (error) {
            console.error('Failed to initialize crypto:', error)
            throw new Error('Crypto initialization failed')
        }
    }
    
    // Generate new Ed25519 key pair
    async generateKeyPair() {
        await this.init()
        
        try {
            const privateKey = this.ed25519.utils.randomPrivateKey()
            const publicKey = await this.ed25519.getPublicKeyAsync(privateKey)
            
            this.keyPair = {
                privateKey: new Uint8Array(privateKey),
                publicKey: new Uint8Array(publicKey),
                created: Date.now()
            }
            
            console.log('Generated new Ed25519 key pair')
            return this.keyPair
        } catch (error) {
            console.error('Key generation failed:', error)
            throw new Error('Key generation failed')
        }
    }
    
    // Load existing key pair from stored data
    async loadKeyPair(identityData) {
        await this.init()
        
        if (!identityData || !identityData.privateKey || !identityData.publicKey) {
            throw new Error('Invalid identity data')
        }
        
        try {
            this.keyPair = {
                privateKey: new Uint8Array(identityData.privateKey),
                publicKey: new Uint8Array(identityData.publicKey),
                created: identityData.created || Date.now()
            }
            
            console.log('Loaded existing Ed25519 key pair')
            return this.keyPair
        } catch (error) {
            console.error('Failed to load key pair:', error)
            throw new Error('Failed to load key pair')
        }
    }
    
    // Sign a message with the private key
    async signMessage(message) {
        if (!this.keyPair) {
            throw new Error('No key pair available. Generate or load keys first.')
        }
        
        await this.init()
        
        try {
            const messageBytes = new TextEncoder().encode(message)
            const signature = await this.ed25519.signAsync(messageBytes, this.keyPair.privateKey)
            
            return new Uint8Array(signature)
        } catch (error) {
            console.error('Message signing failed:', error)
            throw new Error('Message signing failed')
        }
    }
    
    // Verify a message signature
    async verifyMessage(message, signature, publicKey) {
        await this.init()
        
        try {
            const messageBytes = new TextEncoder().encode(message)
            const publicKeyBytes = new Uint8Array(publicKey)
            const signatureBytes = new Uint8Array(signature)
            
            const isValid = await this.ed25519.verifyAsync(
                signatureBytes,
                messageBytes,
                publicKeyBytes
            )
            
            return isValid
        } catch (error) {
            console.error('Message verification failed:', error)
            return false
        }
    }
    
    // Export identity for backup
    exportIdentity(username) {
        if (!this.keyPair) {
            throw new Error('No identity to export')
        }
        
        return {
            username,
            identity: {
                publicKey: Array.from(this.keyPair.publicKey),
                privateKey: Array.from(this.keyPair.privateKey),
                created: this.keyPair.created
            },
            exported: Date.now(),
            version: '1.0'
        }
    }
    
    // Import identity from backup
    async importIdentity(exportedData) {
        if (!exportedData || !exportedData.identity) {
            throw new Error('Invalid export data')
        }
        
        try {
            await this.loadKeyPair(exportedData.identity)
            return exportedData.username || null
        } catch (error) {
            console.error('Identity import failed:', error)
            throw new Error('Identity import failed')
        }
    }
    
    // Get public key as hex string (for display)
    getPublicKeyHex() {
        if (!this.keyPair) return null
        
        return Array.from(this.keyPair.publicKey)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    }
    
    // Get public key fingerprint (first 8 chars of hex)
    getPublicKeyFingerprint() {
        const hex = this.getPublicKeyHex()
        return hex ? hex.substring(0, 8) : null
    }
    
    // Generate deterministic user ID from public key
    getUserId() {
        if (!this.keyPair) return null
        
        // Use first 12 characters of public key hex as user ID
        const hex = this.getPublicKeyHex()
        return hex ? hex.substring(0, 12) : null
    }
}