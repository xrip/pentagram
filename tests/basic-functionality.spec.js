import { test, expect } from '@playwright/test'

test.describe('Pentagram.foo Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load homepage with correct title and setup form', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle('Pentagram - Anonymous P2P Chat')
    
    // Check main heading
    await expect(page.locator('h1')).toContainText('Pentagram.foo')
    
    // Check subtitle mentions BitTorrent P2P
    await expect(page.locator('text=Anonymous P2P Chat via BitTorrent')).toBeVisible()
    
    // Check form elements are present
    await expect(page.locator('input[placeholder="Choose username"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Enter room name"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Room password for extra security"]')).toBeVisible()
    await expect(page.locator('button:has-text("🚀 Join Room")')).toBeVisible()
  })

  test('should initialize Alpine.js app and form functionality', async ({ page }) => {
    // Fill username and test form behavior
    await page.fill('input[placeholder="Choose username"]', 'TestUser123')
    await page.fill('input[placeholder="Enter room name"]', 'test-room-identity')
    
    // Test that the form fields work correctly
    const usernameValue = await page.inputValue('input[placeholder="Choose username"]')
    const roomValue = await page.inputValue('input[placeholder="Enter room name"]')
    
    expect(usernameValue).toBe('TestUser123')
    expect(roomValue).toBe('test-room-identity')
    
    // Test that the join button becomes enabled when both required fields are filled
    const joinButton = page.locator('button:has-text("🚀 Join Room")')
    await expect(joinButton).toBeEnabled()
    
    // Test clearing username disables the button
    await page.fill('input[placeholder="Choose username"]', '')
    await expect(joinButton).toBeDisabled()
    
    // Test filling it back enables the button
    await page.fill('input[placeholder="Choose username"]', 'TestUser123')
    await expect(joinButton).toBeEnabled()
  })

  test('should validate required fields before joining room', async ({ page }) => {
    // Try to join without username
    await page.fill('input[placeholder="Enter room name"]', 'test-room')
    
    const joinButton = page.locator('button:has-text("🚀 Join Room")')
    await expect(joinButton).toBeDisabled()
    
    // Add username
    await page.fill('input[placeholder="Choose username"]', 'TestUser')
    await expect(joinButton).not.toBeDisabled()
    
    // Clear room name
    await page.fill('input[placeholder="Enter room name"]', '')
    await expect(joinButton).toBeDisabled()
  })

  test('should handle room URL parameters correctly', async ({ page }) => {
    // Navigate to room URL with parameters
    await page.goto('/#/room/test-room-123?password=secret123')
    
    // Check that form is pre-filled
    await expect(page.locator('input[placeholder="Enter room name"]')).toHaveValue('test-room-123')
    await expect(page.locator('input[placeholder="Room password for extra security"]')).toHaveValue('secret123')
  })

  test('should show connection status during room joining', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'TestUser')
    await page.fill('input[placeholder="Enter room name"]', 'test-room')
    
    // Click join button
    const joinButton = page.locator('button:has-text("🚀 Join Room")')
    await joinButton.click()
    
    // Should show connecting state
    await expect(page.locator('button:has-text("Connecting...")')).toBeVisible()
    
    // Wait for connection attempt (will timeout in test environment)
    await page.waitForTimeout(5000)
  })

  test('should persist username across sessions', async ({ page, context }) => {
    const username = 'PersistentUser123'
    
    // Set username
    await page.fill('input[placeholder="Choose username"]', username)
    await page.waitForTimeout(500)
    
    // Create new page (simulates page refresh)
    const newPage = await context.newPage()
    await newPage.goto('/')
    await newPage.waitForTimeout(1000)
    
    // Username should be restored
    await expect(newPage.locator('input[placeholder="Choose username"]')).toHaveValue(username)
  })

  test('should handle recent rooms functionality', async ({ page }) => {
    const username = 'TestUser'
    const roomName = 'recent-test-room'
    
    await page.fill('input[placeholder="Choose username"]', username)
    await page.fill('input[placeholder="Enter room name"]', roomName)
    
    // Attempt to join room (will fail in test but should still add to recent)
    await page.locator('button:has-text("🚀 Join Room")').click()
    await page.waitForTimeout(2000)
    
    // Refresh page
    await page.reload()
    await page.waitForTimeout(1000)
    
    // Check if recent rooms section appears
    await expect(page.locator('text=Recent Rooms')).toBeVisible()
    await expect(page.locator(`text=${roomName}`)).toBeVisible()
  })

  test('should handle room creation with password', async ({ page }) => {
    // Test form with password field
    await page.fill('input[placeholder="Choose username"]', 'TestUser')
    await page.fill('input[placeholder="Enter room name"]', 'password-room')
    await page.fill('input[placeholder="Room password for extra security"]', 'secret123')
    
    // Verify all fields have values
    expect(await page.inputValue('input[placeholder="Choose username"]')).toBe('TestUser')
    expect(await page.inputValue('input[placeholder="Enter room name"]')).toBe('password-room')
    expect(await page.inputValue('input[placeholder="Room password for extra security"]')).toBe('secret123')
    
    // Test join button is enabled with all fields
    await expect(page.locator('button:has-text("🚀 Join Room")')).toBeEnabled()
    
    // Test password field functionality (optional field should not block join)
    await page.fill('input[placeholder="Room password for extra security"]', '')
    await expect(page.locator('button:has-text("🚀 Join Room")')).toBeEnabled()
  })
})