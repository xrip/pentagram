# Pentagram.foo Development Workflow

## Phase-by-Phase Implementation with Testing

### Development Commands

```bash
# Install dependencies
bun install

# Install Playwright browsers
bun run install-browsers

# Start development server
bun run dev

# Run all tests
bun run test

# Run specific test suites
bun run test:basic    # Basic functionality
bun run test:crypto   # Identity & crypto
bun run test:p2p      # P2P connections
bun run test:voice    # Voice communication

# Interactive testing
bun run test:ui       # Playwright UI mode
bun run test:headed   # Headed browser mode
bun run test:debug    # Debug mode
```

### Implementation Phases

#### Phase 1: Project Foundation ✅
- [x] Package.json and dependencies
- [x] Vite configuration 
- [x] Playwright test setup
- [x] Basic HTML structure

#### Phase 2: Core Application Structure
- [ ] HTML template with Alpine.js mounting
- [ ] Basic CSS with Tailwind
- [ ] Alpine.js app initialization
- [ ] Storage management service
- [ ] Test: Basic functionality tests should pass

#### Phase 3: Identity & Crypto System
- [ ] Ed25519 key generation
- [ ] Message signing/verification
- [ ] Identity persistence
- [ ] Import/export functionality
- [ ] Test: Crypto tests should pass

#### Phase 4: Room Management
- [ ] Trystero/torrent integration
- [ ] Room joining/leaving
- [ ] URL handling for room sharing
- [ ] Connection status monitoring
- [ ] Test: Basic P2P connection tests

#### Phase 5: Chat Messaging
- [ ] Message sending/receiving
- [ ] Signed message verification
- [ ] Chat UI components
- [ ] Message history
- [ ] Test: Full P2P messaging tests

#### Phase 6: Voice Communication
- [ ] Audio stream capture
- [ ] Voice controls UI
- [ ] Stream sharing via Trystero
- [ ] Mute/unmute functionality
- [ ] Test: Voice communication tests

#### Phase 7: PWA & Polish
- [ ] Service worker
- [ ] Web app manifest
- [ ] Offline functionality
- [ ] Performance optimization
- [ ] Test: All tests passing

### Testing Strategy

1. **After each phase**: Run corresponding test suite
2. **Before moving to next phase**: All previous tests must pass
3. **Daily**: Run full test suite
4. **Before commits**: Run affected tests

### Continuous Testing Commands

```bash
# Watch mode for active development
bun run test:watch

# Run tests for current phase
bun run test:basic  # Phase 2
bun run test:crypto # Phase 3
bun run test:p2p    # Phase 4-5
bun run test:voice  # Phase 6
```

### Quality Gates

Each phase must pass these checks:
- ✅ Corresponding Playwright tests pass
- ✅ No console errors
- ✅ Basic functionality works in browser
- ✅ Code follows ESLint rules

### Development Tips

1. Keep `bun run dev` running in terminal 1
2. Keep `bun run test:watch` running in terminal 2
3. Use `bun run test:ui` for visual debugging
4. Use `bun run test:headed` to see tests run in browser
5. Check localhost:3000 manually after each phase