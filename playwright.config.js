import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['line']
  ],
  
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Allow WebRTC permissions
    permissions: ['microphone'],
    // Extended timeout for P2P connections
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use system Chrome instead of Playwright's bundled Chrome
        channel: 'chrome',
        // WebRTC requires secure context
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--allow-running-insecure-content',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        }
      },
    },
    // {
    //   name: 'firefox', 
    //   use: { 
    //     ...devices['Desktop Firefox'],
    //     launchOptions: {
    //       firefoxUserPrefs: {
    //         'media.navigator.streams.fake': true,
    //         'media.navigator.permission.disabled': true
    //       }
    //     }
    //   },
    // },
    // {
    //   name: 'webkit',
    //   use: { 
    //     ...devices['Desktop Safari'],
    //     launchOptions: {
    //       args: ['--use-fake-ui-for-media-stream']
    //     }
    //   },
    // },
    // {
    //   name: 'mobile-chrome',
    //   use: { 
    //     ...devices['Pixel 5'],
    //     launchOptions: {
    //       args: [
    //         '--use-fake-ui-for-media-stream',
    //         '--use-fake-device-for-media-stream'
    //       ]
    //     }
    //   },
    // }
  ],

  webServer: {
    command: 'bun run dev',
    port: 3002,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Global test timeout
  timeout: 60000,
  
  // Expect timeout for assertions
  expect: {
    timeout: 10000
  }
})