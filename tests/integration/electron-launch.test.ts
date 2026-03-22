import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'
import * as path from 'path'

/**
 * Integration test: launch the Electron app headlessly and verify the
 * OnboardingWizard is shown when no API key is stored.
 *
 * Requires: Xvfb (or equivalent) on CI, and `npm run build` to have been run.
 */
test.describe('Electron App', () => {
  test('shows OnboardingWizard on first launch (no API key)', async () => {
    const extraArgs = process.env.CI ? ['--no-sandbox'] : []
    const app = await electron.launch({
      args: [...extraArgs, path.join(__dirname, '../../dist/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    })

    const window = await app.firstWindow()
    await window.waitForSelector('[data-testid="onboarding-wizard"]', {
      timeout: 10_000,
    })

    const wizard = window.locator('[data-testid="onboarding-wizard"]')
    await expect(wizard).toBeVisible()

    const input = window.locator('[data-testid="api-key-input"]')
    await expect(input).toBeVisible()

    await app.close()
  })
})
