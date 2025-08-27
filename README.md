# Pentagram.foo - Anonymous Serverless P2P Chat

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange.svg)]()
[![P2P: WebRTC](https://img.shields.io/badge/P2P-WebRTC-blue.svg)]()
[![Crypto: Ed25519](https://img.shields.io/badge/Crypto-Ed25519-green.svg)]()

**Anonymous, serverless, end-to-end encrypted group chat using WebRTC peer-to-peer connections via BitTorrent trackers.**

🌐 **[Live Demo](http://localhost:3000)** (when running locally)

## 🎯 Overview

Pentagram.foo is a privacy-first chat application that requires no servers, accounts, or personal data. All communication happens directly between users through WebRTC peer-to-peer connections, coordinated via public BitTorrent trackers.

### Core Principles

- **🔒 Zero-Server Architecture**: No central servers, all P2P via WebRTC
- **👻 Anonymous by Design**: No accounts, emails, or personal data required
- **🛡️ Privacy-First**: End-to-end encrypted with Ed25519 signatures
- **⚡ Instant Access**: Share links to create/join rooms immediately
- **🎯 KISS Implementation**: Simple, maintainable codebase

## 🚀 Quick Start

### Prerequisites

- Modern browser with WebRTC support (Chrome 80+, Firefox 72+, Safari 14+)
- [Node.js](https://nodejs.org/) (v18+) and [bun](https://bun.sh/) or npm.

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-repo/pentagram.foo.git
cd pentagram.foo

# Install dependencies
bun install
# or
npm install

# Start development server
bun run dev
# or
npm run dev

# Open browser
http://localhost:3000
```

### Usage

1. **Choose Username**: Enter any username (no registration needed)
2. **Create/Join Room**: Enter room name and optional password
3. **Share Link**: Copy room link to invite others
4. **Start Chatting**: Messages are encrypted and signed automatically

## 🏗️ Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Alpine.js v3.14.9 | Reactive UI framework |
| **P2P Networking** | Trystero v0.21.6 | WebRTC abstraction |
| **Signaling** | BitTorrent Trackers | Serverless peer discovery |
| **Cryptography** | @noble/ed25519 | Message signing/verification |
| **Styling** | Tailwind CSS | Utility-first styling |
| **Build** | Vite | Development and bundling |

### Application Structure

```
pentagram-foo/
├── index.html                 # Single Page Application
├── src/
│   ├── main.js               # Application entry point
│   ├── styles.css            # Tailwind CSS styles
│   ├── components/
│   │   ├── pentagram-app.js  # Main Alpine component
│   │   └── connection-status.js # P2P status monitor
│   └── services/
│       ├── room-manager.js   # Trystero P2P management
│       ├── crypto-utils.js   # Ed25519 cryptography
│       └── storage-manager.js # localStorage abstraction
├── tests/                    # Playwright test suites
└── docs/                     # Documentation
```

## 🔐 Security Model

### Identity System

Each user automatically gets:
- **Ed25519 Key Pair**: Generated client-side, never transmitted
- **Digital Signatures**: All messages cryptographically signed
- **Identity Portability**: Export/import keys as JSON files
- **No Registration**: Identity exists only in browser storage

### Encryption Layers

1. **Transport**: WebRTC DTLS (built-in P2P encryption)
2. **Session**: Trystero AES-GCM (session data encryption)
3. **Room**: Optional password-based room encryption
4. **Message**: Ed25519 signatures for authenticity

### Privacy Features

- **No Data Persistence**: Messages only exist during session
- **No Server Logs**: Direct peer-to-peer communication
- **Anonymous Identities**: No real-world correlation
- **Ephemeral Rooms**: Exist only while users connected

## 🌐 P2P Networking

### BitTorrent Strategy

Pentagram.foo uses BitTorrent trackers for WebRTC signaling:

```javascript
// Default tracker configuration
relayUrls: [
    'wss://tracker.webtorrent.dev',
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.webtorrent.io',
    'wss://tracker.btorrent.xyz',
    'wss://spacetradersapi-chatbox.herokuapp.com'
]
```

**Benefits:**
- **Decentralized**: No single point of failure
- **Battle-tested**: Mature BitTorrent infrastructure
- **Free**: No API keys or accounts needed
- **Redundant**: Multiple trackers for reliability

### Message Protocol

```typescript
interface ChatMessage {
  id: string              // UUID for deduplication
  content: string         // Message text
  username: string        // Sender's chosen username
  timestamp: number       // Unix timestamp
  signature: number[]     // Ed25519 signature (as array)
}

interface UserInfo {
  username: string        // Display name
  publicKey: number[]     // Ed25519 public key (as array)
  joinedAt: number       // Join timestamp
}
```

## 💻 Implementation Details

### Alpine.js Integration

The application uses Alpine.js for reactive UI management:

```javascript
Alpine.data('pentagramApp', () => ({
    // Persisted state
    username: Alpine.$persist('').as('pentagram-username'),
    identity: Alpine.$persist(null).as('pentagram-identity'),
    
    // Session state
    isConnected: false,
    peers: new Map(),
    messages: [],
    
    // Services
    roomManager: null,
    cryptoManager: null,
    
    // Lifecycle
    async init() {
        await this.initializeServices()
        await this.initializeIdentity()
        this.loadRoomFromURL()
    }
}))
```

### Cryptographic Operations

Message signing and verification:

```javascript
// Sign outgoing message
const signature = await cryptoManager.signMessage(messageText)
const message = {
    content: messageText,
    signature: Array.from(signature),
    // ... other fields
}

// Verify incoming message
const isValid = await cryptoManager.verifyMessage(
    message.content,
    new Uint8Array(message.signature),
    peer.publicKey
)
```

### P2P Room Management

```javascript
// Join room via BitTorrent trackers
const room = await roomManager.joinRoom(roomId, password)

// Setup communication channels
const [sendMessage, getMessage] = room.makeAction('message')
const [sendUserInfo, getUserInfo] = room.makeAction('userInfo')

// Handle peer events
room.onPeerJoin(peerId => {
    // Send user info to new peer
    sendUserInfo({ username, publicKey }, peerId)
})
```

## 🔍 Points of Interest (POIs)

### 1. **Serverless Architecture** 📍
- **Location**: `src/services/room-manager.js`
- **Key Concept**: Using BitTorrent trackers as signaling servers
- **Innovation**: No backend infrastructure required

### 2. **Client-Side Cryptography** 📍
- **Location**: `src/services/crypto-utils.js`
- **Key Concept**: Ed25519 signatures for message authenticity
- **Security**: Keys never leave the browser

### 3. **Progressive Enhancement** 📍
- **Location**: `src/components/pentagram-app.js`
- **Key Concept**: Graceful degradation when P2P fails
- **UX**: Clear status indicators and error handling

### 4. **Persistent Identity** 📍
- **Location**: Alpine.js `$persist` usage
- **Key Concept**: Identity survives browser refresh
- **Privacy**: Data stays local, exportable for backup

### 5. **Real-time P2P Messaging** 📍
- **Location**: Message handling in `pentagram-app.js`
- **Key Concept**: Signed messages with verification
- **Performance**: Direct peer-to-peer, no relay servers

### 6. **Connection Quality Monitoring** 📍
- **Location**: `src/components/connection-status.js`
- **Key Concept**: Real-time tracker connection status
- **UX**: Visual feedback for P2P network health

### 7. **Room Sharing System** 📍
- **Location**: URL handling and room link generation
- **Key Concept**: Shareable URLs with optional passwords
- **Usability**: One-click room joining

### 8. **Message Verification Pipeline** 📍
- **Location**: `handleIncomingMessage()` function
- **Key Concept**: Reject messages with invalid signatures
- **Security**: Prevents message spoofing

### 9. **Graceful P2P Failure** 📍
- **Location**: Error handling throughout room management
- **Key Concept**: Informative error messages for P2P issues
- **Reliability**: Fallback states and retry mechanisms

### 10. **Zero-Configuration Setup** 📍
- **Location**: CDN-based dependency loading
- **Key Concept**: No build step required for basic usage
- **Accessibility**: Lower barrier to entry

## 🧪 Testing

### Running Tests

```bash
# Install Playwright (if needed)
npm install @playwright/test

# Run all tests
npx playwright test

# Run specific test suites
npx playwright test tests/basic-functionality.spec.js
npx playwright test tests/crypto-identity.spec.js
npx playwright test tests/p2p-connection.spec.js

# Interactive testing
npx playwright test --ui
```

### Test Coverage

- **Basic Functionality**: UI components, form validation
- **Cryptographic Identity**: Key generation, signing, verification
- **P2P Connections**: Room joining, peer discovery, messaging
- **Error Handling**: Network failures, invalid data

### Manual Testing

1. **Multi-User Chat**: Open multiple browser tabs/windows
2. **Cross-Browser**: Test in Chrome, Firefox, Safari
3. **Network Conditions**: Test with slow/intermittent connections
4. **Identity Management**: Export/import keys, clear data

## 🚧 Development Status

### Current Phase: **Alpha - Core P2P Chat Complete**

**✅ Implemented:**
- Anonymous identity system (Ed25519)
- P2P room management (Trystero + BitTorrent)
- Secure messaging with signatures
- Real-time peer discovery
- Connection quality monitoring
- Identity export/import

**🔄 In Progress:**
- Voice communication (WebRTC audio streams)
- Progressive Web App features
- Performance optimizations

**📋 Planned:**
- File sharing
- Emoji reactions
- Message history
- Mobile optimizations

## 🤝 Contributing

### Development Setup

```bash
# Development dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Code formatting
npm run format
```

### Code Style

- **JavaScript**: ES2022, async/await patterns
- **Alpine.js**: Composition API, avoid deep nesting
- **CSS**: Tailwind utilities, minimal custom CSS
- **Security**: Input sanitization, CSP headers

### Pull Request Process

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm run test`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Trystero**: Excellent WebRTC P2P library
- **Alpine.js**: Lightweight reactive framework
- **@noble/ed25519**: Pure JavaScript Ed25519 implementation
- **BitTorrent Community**: Decentralized tracker infrastructure
- **WebRTC Specification**: Enabling direct peer communication

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Security**: Report vulnerabilities via private disclosure

---

**Built with ❤️ for privacy, decentralization, and user freedom.**

*No servers • No accounts • No tracking • Just pure P2P communication*