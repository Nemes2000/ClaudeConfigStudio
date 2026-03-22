import { defineConfig } from '@playwright/test'
import { resolve } from 'path'

export default defineConfig({
  testDir: './tests/integration',
  timeout: 60_000,
  expect: { timeout: 10_000 },
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
