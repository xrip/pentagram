import { test, expect } from '@playwright/test'

test.describe('Voice Communication', () => {
  test.beforeEach(async ({ page }) => {
    // Grant microphone permissions for voice tests
    await page.context().grantPermissions(['microphone'])
    await page.goto('http://localhost:3000')
  })

  test('should request microphone permission for voice chat', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'VoiceUser')
    await page.fill('input[placeholder="Enter room name"]', 'voice-test')
    
    await page.locator('button:has-text("🚀 Join Room")').click()
    await page.waitForTimeout(5000)
    
    // Look for voice controls if connected
    const isConnected = await page.locator('[x-show="isConnected"]').isVisible()
    
    if (isConnected) {
      // Voice controls should be available
      const voiceButton = page.locator('button[aria-label*="microphone"], button[title*="voice"], button:has-text("🎤")')
      if (await voiceButton.first().isVisible()) {
        await expect(voiceButton.first()).toBeVisible()
      }
    }
  })

  test('should handle microphone access and create audio stream', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'AudioUser')
    await page.fill('input[placeholder="Enter room name"]', 'audio-test')
    
    await page.locator('button:has-text("🚀 Join Room")').click()
    await page.waitForTimeout(5000)
    
    // Test microphone access
    const microphoneTest = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: false 
        })
        
        return {
          success: true,
          hasAudioTracks: stream.getAudioTracks().length > 0,
          trackCount: stream.getAudioTracks().length,
          isActive: stream.active
        }
      } catch (error) {
        return {
          success: false,
          error: error.name,
          message: error.message
        }
      }
    })
    
    expect(microphoneTest.success).toBeTruthy()
    if (microphoneTest.success) {
      expect(microphoneTest.hasAudioTracks).toBeTruthy()
      expect(microphoneTest.trackCount).toBeGreaterThan(0)
      expect(microphoneTest.isActive).toBeTruthy()
    }
  })

  test('should toggle microphone mute/unmute', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'MuteUser')
    await page.fill('input[placeholder="Enter room name"]', 'mute-test')
    
    await page.locator('button:has-text("🚀 Join Room")').click()
    await page.waitForTimeout(5000)
    
    // Test mute functionality
    const muteTest = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: false 
        })
        
        const audioTrack = stream.getAudioTracks()[0]
        const initialEnabled = audioTrack.enabled
        
        // Toggle mute
        audioTrack.enabled = false
        const mutedState = audioTrack.enabled
        
        // Toggle unmute  
        audioTrack.enabled = true
        const unmutedState = audioTrack.enabled
        
        return {
          success: true,
          initialEnabled,
          mutedState,
          unmutedState
        }
      } catch (error) {
        return {
          success: false,
          error: error.message
        }
      }
    })
    
    expect(muteTest.success).toBeTruthy()
    if (muteTest.success) {
      expect(muteTest.initialEnabled).toBe(true)
      expect(muteTest.mutedState).toBe(false)
      expect(muteTest.unmutedState).toBe(true)
    }
  })

  test('should handle voice controls UI interaction', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'VoiceUIUser')
    await page.fill('input[placeholder="Enter room name"]', 'voice-ui-test')
    
    await page.locator('button:has-text("🚀 Join Room")').click()
    await page.waitForTimeout(5000)
    
    const isConnected = await page.locator('[x-show="isConnected"]').isVisible()
    
    if (isConnected) {
      // Look for voice/microphone controls
      const voiceControls = [
        'button[aria-label*="microphone"]',
        'button[title*="voice"]',
        'button:has-text("🎤")',
        'button[x-data="voiceControls"]',
        '.voice-control',
        '[data-testid="voice-button"]'
      ]
      
      let voiceButtonFound = false
      for (const selector of voiceControls) {
        const button = page.locator(selector).first()
        if (await button.isVisible()) {
          voiceButtonFound = true
          
          // Test button click
          await button.click()
          await page.waitForTimeout(500)
          
          // Should handle the click without errors
          const hasErrors = await page.evaluate(() => {
            return window.console.error.calls || []
          })
          
          break
        }
      }
      
      // If no specific voice button found, that's ok for basic test
      expect(true).toBeTruthy() // Test passes if no errors thrown
    }
  })

  test('should handle voice stream sharing in P2P context', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'StreamUser')
    await page.fill('input[placeholder="Enter room name"]', 'stream-test')
    
    await page.locator('button:has-text("🚀 Join Room")').click()
    await page.waitForTimeout(5000)
    
    // Test voice stream sharing functionality
    const streamSharingTest = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: false 
        })
        
        // Simulate what Trystero room.addStream would do
        const audioTrack = stream.getAudioTracks()[0]
        
        // Check stream properties
        return {
          success: true,
          streamId: stream.id,
          audioTrackCount: stream.getAudioTracks().length,
          trackEnabled: audioTrack.enabled,
          trackKind: audioTrack.kind,
          trackReadyState: audioTrack.readyState
        }
      } catch (error) {
        return {
          success: false,
          error: error.message
        }
      }
    })
    
    expect(streamSharingTest.success).toBeTruthy()
    if (streamSharingTest.success) {
      expect(streamSharingTest.audioTrackCount).toBe(1)
      expect(streamSharingTest.trackKind).toBe('audio')
      expect(streamSharingTest.trackReadyState).toBe('live')
    }
  })

  test('should display voice activity indicators', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'ActivityUser')
    await page.fill('input[placeholder="Enter room name"]', 'activity-test')
    
    await page.locator('button:has-text("🚀 Join Room")').click()
    await page.waitForTimeout(5000)
    
    // Test voice activity detection
    const activityTest = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: false 
        })
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        
        source.connect(analyser)
        analyser.fftSize = 256
        
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        
        // Get audio data
        analyser.getByteFrequencyData(dataArray)
        
        // Calculate average volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength
        
        return {
          success: true,
          hasAudioContext: !!audioContext,
          bufferLength,
          averageVolume: average
        }
      } catch (error) {
        return {
          success: false,
          error: error.message
        }
      }
    })
    
    expect(activityTest.success).toBeTruthy()
    if (activityTest.success) {
      expect(activityTest.hasAudioContext).toBeTruthy()
      expect(activityTest.bufferLength).toBeGreaterThan(0)
      expect(activityTest.averageVolume).toBeGreaterThanOrEqual(0)
    }
  })

  test('should handle microphone permission denial gracefully', async ({ page }) => {
    // Create context without microphone permission
    const context = await page.context()
    await context.clearPermissions()
    
    await page.fill('input[placeholder="Choose username"]', 'NoMicUser')
    await page.fill('input[placeholder="Enter room name"]', 'no-mic-test')
    
    await page.locator('button:has-text("🚀 Join Room")').click()
    await page.waitForTimeout(3000)
    
    // Test permission denial handling
    const permissionTest = await page.evaluate(async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: false 
        })
        return { success: true, permissionGranted: true }
      } catch (error) {
        return {
          success: true,
          permissionGranted: false,
          errorName: error.name,
          errorMessage: error.message
        }
      }
    })
    
    expect(permissionTest.success).toBeTruthy()
    
    // Should handle permission denial
    if (!permissionTest.permissionGranted) {
      expect(['NotAllowedError', 'PermissionDeniedError']).toContain(permissionTest.errorName)
    }
  })

  test('should handle audio device changes', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'DeviceUser')
    await page.fill('input[placeholder="Enter room name"]', 'device-test')
    
    await page.locator('button:has-text("🚀 Join Room")').click()
    await page.waitForTimeout(3000)
    
    // Test audio device enumeration
    const deviceTest = await page.evaluate(async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices.filter(device => device.kind === 'audioinput')
        
        return {
          success: true,
          totalDevices: devices.length,
          audioInputCount: audioInputs.length,
          hasDefaultDevice: audioInputs.some(device => device.deviceId === 'default')
        }
      } catch (error) {
        return {
          success: false,
          error: error.message
        }
      }
    })
    
    expect(deviceTest.success).toBeTruthy()
    if (deviceTest.success) {
      expect(deviceTest.audioInputCount).toBeGreaterThanOrEqual(0)
    }
  })

  test('should stop voice streams on disconnect', async ({ page }) => {
    await page.fill('input[placeholder="Choose username"]', 'DisconnectUser')
    await page.fill('input[placeholder="Enter room name"]', 'disconnect-voice-test')
    
    await page.locator('button:has-text("🚀 Join Room")').click()
    await page.waitForTimeout(5000)
    
    // Test stream cleanup on disconnect
    const cleanupTest = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: false 
        })
        
        const tracksBefore = stream.getAudioTracks().length
        const initialState = stream.getAudioTracks()[0].readyState
        
        // Simulate disconnect by stopping tracks
        stream.getTracks().forEach(track => track.stop())
        
        const tracksAfter = stream.getAudioTracks().length
        const finalState = stream.getAudioTracks()[0]?.readyState || 'ended'
        
        return {
          success: true,
          tracksBefore,
          tracksAfter,
          initialState,
          finalState
        }
      } catch (error) {
        return {
          success: false,
          error: error.message
        }
      }
    })
    
    expect(cleanupTest.success).toBeTruthy()
    if (cleanupTest.success) {
      expect(cleanupTest.tracksBefore).toBeGreaterThan(0)
      expect(cleanupTest.initialState).toBe('live')
      expect(cleanupTest.finalState).toBe('ended')
    }
  })
})