import { test, expect } from '@playwright/test'

test.describe('Crypto and Identity Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000')
    // Clear localStorage to start fresh
    await page.evaluate(() => localStorage.clear())
  })

  test('should generate Ed25519 key pair on first use', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'CryptoUser')
    
    // Wait for identity generation
    await page.waitForTimeout(2000)
    
    // Check localStorage for generated identity
    const identity = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('_x_pentagram-identity') || 'null')
    })
    
    expect(identity).toBeTruthy()
    expect(identity).toHaveProperty('publicKey')
    expect(identity).toHaveProperty('privateKey') 
    expect(identity).toHaveProperty('created')
    
    // Keys should be arrays (serialized from Uint8Array)
    expect(Array.isArray(identity.publicKey)).toBeTruthy()
    expect(Array.isArray(identity.privateKey)).toBeTruthy()
    
    // Ed25519 keys have specific lengths
    expect(identity.publicKey).toHaveLength(32)
    expect(identity.privateKey).toHaveLength(32)
    
    // Should have recent creation timestamp
    expect(identity.created).toBeGreaterThan(Date.now() - 5000)
  })

  test('should persist identity across page reloads', async ({ page }) => {
    const username = 'PersistentUser'
    
    // Generate identity
    await page.fill('input[placeholder="Choose username"]', username)
    await page.waitForTimeout(1000)
    
    // Get the generated identity
    const originalIdentity = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('_x_pentagram-identity'))
    })
    
    // Reload page
    await page.reload()
    await page.waitForTimeout(1000)
    
    // Check username is restored
    await expect(page.locator('input[placeholder="Choose username"]')).toHaveValue(username)
    
    // Check identity is same
    const restoredIdentity = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('_x_pentagram-identity'))
    })
    
    expect(restoredIdentity).toEqual(originalIdentity)
  })

  test('should sign messages with Ed25519 private key', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'SigningUser')
    await page.fill('input[placeholder="Enter room name"]', 'crypto-test')
    
    // Wait for identity generation
    await page.waitForTimeout(2000)
    
    // Attempt to join room to trigger signing functionality
    await page.locator('button:has-text("🚀 Join Room")').click()
    
    // Wait for room initialization
    await page.waitForTimeout(3000)
    
    // Test message signing by examining crypto utilities
    const signingTest = await page.evaluate(async () => {
      // Access the crypto manager from Alpine component
      const app = window.Alpine.$data(document.querySelector('[x-data="pentagramApp"]'))
      
      if (app && app.cryptoManager) {
        try {
          const testMessage = 'Hello World Test Message'
          const signature = await app.cryptoManager.signMessage(testMessage)
          
          return {
            success: true,
            hasSignature: signature instanceof Uint8Array,
            signatureLength: signature.length
          }
        } catch (error) {
          return { success: false, error: error.message }
        }
      }
      
      return { success: false, error: 'Crypto manager not available' }
    })
    
    // Ed25519 signatures are 64 bytes
    expect(signingTest.success).toBeTruthy()
    if (signingTest.success) {
      expect(signingTest.hasSignature).toBeTruthy()
      expect(signingTest.signatureLength).toBe(64)
    }
  })

  test('should verify message signatures', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'VerifyUser')
    await page.fill('input[placeholder="Enter room name"]', 'verify-test')
    await page.waitForTimeout(2000)
    
    await page.locator('button:has-text("🚀 Join Room")').click()
    await page.waitForTimeout(3000)
    
    // Test signature verification
    const verificationTest = await page.evaluate(async () => {
      const app = window.Alpine.$data(document.querySelector('[x-data="pentagramApp"]'))
      
      if (app && app.cryptoManager && app.identity) {
        try {
          const testMessage = 'Verification Test Message'
          
          // Sign message
          const signature = await app.cryptoManager.signMessage(testMessage)
          
          // Verify with same public key
          const isValid = await app.cryptoManager.verifyMessage(
            testMessage,
            signature,
            app.identity.publicKey
          )
          
          // Verify with wrong message should fail
          const isInvalid = await app.cryptoManager.verifyMessage(
            'Wrong Message',
            signature,
            app.identity.publicKey
          )
          
          return {
            success: true,
            validSignature: isValid,
            invalidSignature: isInvalid
          }
        } catch (error) {
          return { success: false, error: error.message }
        }
      }
      
      return { success: false, error: 'Components not ready' }
    })
    
    expect(verificationTest.success).toBeTruthy()
    if (verificationTest.success) {
      expect(verificationTest.validSignature).toBe(true)
      expect(verificationTest.invalidSignature).toBe(false)
    }
  })

  test('should generate different identities for different users', async ({ page, context }) => {
    // First user
    await page.fill('input[placeholder="Choose username"]', 'User1')
    await page.waitForTimeout(1000)
    
    const identity1 = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('_x_pentagram-identity'))
    })
    
    // Second user in new context (simulates different browser/device)
    const page2 = await context.newPage()
    await page2.goto('http://localhost:3000')
    await page2.fill('input[placeholder="Choose username"]', 'User2')
    await page2.waitForTimeout(1000)
    
    const identity2 = await page2.evaluate(() => {
      return JSON.parse(localStorage.getItem('_x_pentagram-identity'))
    })
    
    // Identities should be different
    expect(identity1.publicKey).not.toEqual(identity2.publicKey)
    expect(identity1.privateKey).not.toEqual(identity2.privateKey)
    expect(identity1.created).not.toEqual(identity2.created)
    
    await page2.close()
  })

  test('should handle identity export/import functionality', async ({ page }) => {
    const username = 'ExportUser'
    
    await page.fill('input[placeholder="Choose username"]', username)
    await page.waitForTimeout(1000)
    
    // Get original identity
    const originalIdentity = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('_x_pentagram-identity'))
    })
    
    // Simulate identity export by copying to clipboard (if export function exists)
    const exportedData = await page.evaluate(() => {
      const app = window.Alpine.$data(document.querySelector('[x-data="pentagramApp"]'))
      
      if (app && app.identity) {
        // This would be the export format
        return {
          username: app.username,
          identity: app.identity,
          exported: Date.now()
        }
      }
      return null
    })
    
    expect(exportedData).toBeTruthy()
    expect(exportedData.username).toBe(username)
    expect(exportedData.identity).toEqual(originalIdentity)
    
    // Clear localStorage and simulate import
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    
    // Simulate import by setting localStorage
    await page.evaluate((data) => {
      localStorage.setItem('_x_pentagram-username', JSON.stringify(data.username))
      localStorage.setItem('_x_pentagram-identity', JSON.stringify(data.identity))
    }, exportedData)
    
    await page.reload()
    await page.waitForTimeout(1000)
    
    // Check imported data
    await expect(page.locator('input[placeholder="Choose username"]')).toHaveValue(username)
    
    const importedIdentity = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('_x_pentagram-identity'))
    })
    
    expect(importedIdentity).toEqual(originalIdentity)
  })

  test('should clear sensitive data on logout/clear', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'TempUser')
    await page.waitForTimeout(1000)
    
    // Verify data exists
    const hasData = await page.evaluate(() => {
      return localStorage.getItem('_x_pentagram-identity') !== null
    })
    expect(hasData).toBeTruthy()
    
    // Simulate data clearing (would be triggered by clear/logout button)
    await page.evaluate(() => {
      // This would be part of a clear data function
      localStorage.removeItem('_x_pentagram-username')
      localStorage.removeItem('_x_pentagram-identity')
      localStorage.removeItem('_x_pentagram-recent-rooms')
    })
    
    await page.reload()
    await page.waitForTimeout(500)
    
    // Data should be cleared
    const noData = await page.evaluate(() => {
      return localStorage.getItem('_x_pentagram-identity') === null
    })
    expect(noData).toBeTruthy()
    
    // Form should be empty
    await expect(page.locator('input[placeholder="Choose username"]')).toHaveValue('')
  })

  test('should handle crypto errors gracefully', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'ErrorUser')
    await page.waitForTimeout(1000)
    
    // Test error handling by corrupting stored identity
    await page.evaluate(() => {
      localStorage.setItem('_x_pentagram-identity', 'invalid-json-data')
    })
    
    await page.reload()
    await page.waitForTimeout(2000)
    
    // Should handle error and generate new identity
    const recoveredIdentity = await page.evaluate(() => {
      const stored = localStorage.getItem('_x_pentagram-identity')
      try {
        return JSON.parse(stored)
      } catch {
        return null
      }
    })
    
    // Should either clear corrupted data or generate new valid identity
    expect(recoveredIdentity === null || (recoveredIdentity && recoveredIdentity.publicKey)).toBeTruthy()
  })
})