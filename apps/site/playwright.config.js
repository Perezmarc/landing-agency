import { defineConfig, devices } from '@playwright/test'

// E2E for the marketing site. Builds the real static output and serves it with
// `astro preview`, so the tests read exactly the HTML a crawler would.
//
// This site has no backend by construction — it is static files — so there is
// no "with no backend configured" caveat here the way there is for the app.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4321 --host',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
