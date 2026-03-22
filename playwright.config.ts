import { defineConfig } from '@playwright/test'
import { resolve } from 'path'

export default defineConfig({
  testDir: './tests/integration',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 2 : 0,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['junit', { outputFile: 'test-results/results.xml' }]],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
      use: {
        // Electron-specific config wired via custom fixtures
      },
    },
  ],
})
