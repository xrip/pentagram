# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pentagram.foo is an anonymous serverless WebRTC chat application that enables P2P group communications via BitTorrent trackers. The app uses Alpine.js for reactive UI, Trystero for WebRTC abstraction, and Ed25519 cryptography for message signing.

## Development Commands

### Core Development
- `npm run dev` or `bun run dev` - Start Vite development server on port 3000
- `npm run build` or `bun run build` - Build production bundle
- `npm run preview` or `bun run preview` - Preview production build

### Testing (Playwright)
- `npm run test` - Run all Playwright tests
- `npm run test:ui` - Interactive Playwright test runner
- `npm run test:headed` - Run tests in headed browser mode
- `npm run test:debug` - Debug mode for tests
- `npm run test:basic` - Run basic functionality tests only
- `npm run test:crypto` - Run crypto/identity tests only
- `npm run test:p2p` - Run P2P connection tests only
- `npm run test:voice` - Run voice communication tests only
- `npm run test:watch` - Run tests in watch mode
- `npm run install-browsers` - Install Playwright browsers

### Code Quality
- `npm run lint` - Run ESLint on src/
- `npm run format` - Format code with Prettier

## Architecture Overview

### Key Technologies
- **Frontend**: Alpine.js v3.14.9 (CDN-loaded)
- **WebRTC**: Trystero v0.21.6 (BitTorrent strategy)
- **Crypto**: @noble/ed25519 for Ed25519 signatures
- **Build**: Vite with PWA plugin
- **Testing**: Playwright for E2E tests
- **Styling**: Tailwind CSS with custom theme

### Application Structure
```
src/
├── main.js                    # Entry point, service worker registration
├── components/
│   ├── pentagram-app.js      # Main Alpine.js app component
│   └── connection-status.js   # P2P connection quality monitor
├── services/
│   ├── room-manager.js       # Trystero P2P room management
│   ├── crypto-utils.js       # Ed25519 cryptography utilities
│   └── storage-manager.js    # localStorage abstraction
└── styles.css                # Tailwind CSS imports
```

### Core Components

#### Main App Component (`src/components/pentagram-app.js`)
- Central Alpine.js component managing all app state
- Uses Alpine.persist for identity and recent rooms storage
- Handles room joining, messaging, peer management
- Key methods: `joinRoom()`, `sendChatMessage()`, `leaveRoom()`

#### Room Manager (`src/services/room-manager.js`)
- Wraps Trystero BitTorrent strategy for WebRTC signaling
- Uses multiple BitTorrent trackers for redundancy
- Manages peer connections and communication channels
- Handles audio streaming for voice chat (future phase)

#### Crypto Manager (`src/services/crypto-utils.js`)
- Ed25519 key pair generation and management
- Message signing and verification for authenticity
- Identity export/import functionality
- Uses @noble/ed25519 library loaded from CDN

### Key Features

#### P2P Messaging
- Messages are signed with Ed25519 private keys
- Peer identity verification via public key cryptography
- Real-time P2P communication via WebRTC data channels
- No central servers - all communication is peer-to-peer

#### Identity System
- Client-side Ed25519 key pair generation
- Anonymous usernames with cryptographic identity backing
- Identity persistence in localStorage via Alpine.persist
- Export/import for backup and cross-device usage

#### Room Management
- BitTorrent trackers used for WebRTC signaling
- Shareable room URLs with optional passwords
- Recent rooms history for easy rejoining
- Real-time peer discovery and connection quality monitoring

## Development Notes

### CDN Dependencies
The app loads most dependencies from CDN to minimize build complexity:
- Alpine.js and plugins from jsDelivr
- Trystero from jsDelivr
- @noble/ed25519 from Skypack (in crypto-utils.js)

### Testing Configuration
Playwright tests are configured with:
- WebRTC permissions pre-granted
- Fake media devices for voice testing
- Extended timeouts for P2P connections (30s)
- Multiple browser testing (Chromium, Firefox, WebKit)

### Build Configuration
Vite is configured with:
- Manual chunk splitting for optimal loading
- PWA plugin for service worker generation
- PostCSS for Tailwind processing
- Development server on port 3000

### Phase-Based Development
The project follows a phase-based approach:
1. Foundation & Basic UI
2. Identity & Crypto System  
3. P2P Room Management
4. Chat Messaging
5. Voice Communication (planned)
6. PWA Features (planned)

Check `dev-workflow.md` for detailed phase implementation status.

## Testing Notes

### Playwright Test Structure
- `tests/basic-functionality.spec.js` - UI components and form validation
- `tests/crypto-identity.spec.js` - Identity generation, signing, verification
- `tests/p2p-connection.spec.js` - Room joining, peer discovery, messaging
- `tests/voice-communication.spec.js` - Audio streaming (future implementation)

### Test Environment
- Tests run against development server on localhost:3000
- WebRTC permissions pre-granted for testing
- Fake media devices configured for voice testing
- Network conditions and error scenarios are tested

## Common Patterns

### Alpine.js State Management
- Use Alpine.persist for data that should survive page refreshes
- Services are imported dynamically and initialized in `init()` method
- UI state is reactive and bound to component properties

### Error Handling
- All async operations use try/catch blocks
- User-friendly error messages via notification system
- Graceful fallbacks for P2P connection failures

### P2P Communication
- Actions are created via `room.makeAction(actionId)` pattern
- Message verification is mandatory for all incoming messages
- Peer information is exchanged on connection

When working on this codebase, focus on maintaining the KISS (Keep It Simple) principle and ensuring all P2P communication remains secure through proper message verification.