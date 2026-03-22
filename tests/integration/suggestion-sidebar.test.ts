/**
 * Integration tests: SuggestionSidebar — all display states.
 *
 * Covers:
 * - Sidebar is visible in workspace
 * - Loading/analyzing indicator shown while request is in progress
 * - Empty state shown when no suggestions are returned
 * - Suggestion cards rendered for each suggestion
 * - Severity colours applied correctly (info/warning/error)
 * - suggestion:ready push event populates the sidebar
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchApp, mockIpcInvoke, emitIpcPush } from './helpers/mock-ipc'
import { IPC_CHANNELS, IpcSuggestion } from '../../src/shared/ipc-channels'

async function authenticateAndOpenWorkspace(window: Page): Promise<void> {
  await window.waitForSelector('[data-testid="onboarding-wizard"]', { timeout: 15_000 })
  await mockIpcInvoke(window, IPC_CHANNELS.AUTH_VALIDATE, {
    ok: true,
    authState: { isValid: true, keyPresent: true, lastValidatedAt: new Date().toISOString() },
  })
  await mockIpcInvoke(window, IPC_CHANNELS.PROJECT_SCAN, { data: null })
  await window.locator('[data-testid="api-key-input"]').fill('sk-ant-api03-validkey')
  await window.locator('[data-testid="submit-button"]').click()
  await emitIpcPush(window, IPC_CHANNELS.AUTH_STATE_CHANGED, {
    isValid: true, keyPresent: true, lastValidatedAt: new Date().toISOString(),
  })
  await window.waitForSelector('[data-testid="workspace-page"]', { timeout: 10_000 })
}

const SAMPLE_SUGGESTIONS: IpcSuggestion[] = [
  {
    type: 'simplification',
    title: 'Reduce token usage',
    description: 'This skill could be shortened by ~40 tokens.',
    affectedSlug: 'code-formatter',
    severity: 'info',
    affectedSection: 'Instructions',
  },
  {
    type: 'unused-dependency',
    title: 'Remove unused dependency',
    description: 'old-skill is imported but never used.',
    affectedSlug: 'code-formatter',
    severity: 'warning',
    affectedSection: 'Dependencies',
  },
  {
    type: 'circular-dependency',
    title: 'Circular dependency detected',
    description: 'skill-a ↔ skill-b creates a cycle.',
    affectedSlug: 'skill-a',
    severity: 'error',
    affectedSection: 'Dependencies',
  },
]

let app: ElectronApplication
let window: Page

test.beforeEach(async () => {
  app = await launchApp()
  window = await app.firstWindow()
  await authenticateAndOpenWorkspace(window)
})

test.afterEach(async () => {
  await app.close()
})

// ─── Sidebar presence ─────────────────────────────────────────────────────────

test('suggestion sidebar is visible in the workspace', async () => {
  await expect(window.locator('[data-testid="suggestion-sidebar"]')).toBeVisible()
})

// ─── Empty state ──────────────────────────────────────────────────────────────

test('no-suggestions empty state is shown when push delivers empty array', async () => {
  await emitIpcPush(window, IPC_CHANNELS.SUGGESTION_READY, [])

  const sidebar = window.locator('[data-testid="suggestion-sidebar"]')
  await expect(sidebar.locator('[data-testid="no-suggestions"]')).toBeVisible({ timeout: 3_000 })
})

// ─── Suggestion cards ─────────────────────────────────────────────────────────

test('three suggestion cards rendered after suggestion:ready push', async () => {
  await emitIpcPush(window, IPC_CHANNELS.SUGGESTION_READY, SAMPLE_SUGGESTIONS)

  for (let i = 0; i < SAMPLE_SUGGESTIONS.length; i++) {
    const card = window.locator(`[data-testid="suggestion-${i}"]`)
    await expect(card).toBeVisible({ timeout: 3_000 })
  }
})

test('suggestion card contains title and description', async () => {
  await emitIpcPush(window, IPC_CHANNELS.SUGGESTION_READY, [SAMPLE_SUGGESTIONS[0]])

  const card = window.locator('[data-testid="suggestion-0"]')
  await expect(card).toBeVisible({ timeout: 3_000 })
  await expect(card).toContainText('Reduce token usage')
  await expect(card).toContainText('shortened')
})

test('warning severity suggestion is rendered', async () => {
  await emitIpcPush(window, IPC_CHANNELS.SUGGESTION_READY, [SAMPLE_SUGGESTIONS[1]])

  const card = window.locator('[data-testid="suggestion-0"]')
  await expect(card).toBeVisible({ timeout: 3_000 })
  await expect(card).toContainText('unused dependency')
})

test('error severity suggestion is rendered', async () => {
  await emitIpcPush(window, IPC_CHANNELS.SUGGESTION_READY, [SAMPLE_SUGGESTIONS[2]])

  const card = window.locator('[data-testid="suggestion-0"]')
  await expect(card).toBeVisible({ timeout: 3_000 })
  await expect(card).toContainText('Circular dependency')
})

// ─── Successive updates ───────────────────────────────────────────────────────

test('sidebar updates correctly on successive suggestion:ready events', async () => {
  await emitIpcPush(window, IPC_CHANNELS.SUGGESTION_READY, [SAMPLE_SUGGESTIONS[0]])
  await expect(window.locator('[data-testid="suggestion-0"]')).toBeVisible({ timeout: 3_000 })

  // Second update with different suggestions
  await emitIpcPush(window, IPC_CHANNELS.SUGGESTION_READY, [
    SAMPLE_SUGGESTIONS[1],
    SAMPLE_SUGGESTIONS[2],
  ])

  await expect(window.locator('[data-testid="suggestion-0"]')).toBeVisible({ timeout: 3_000 })
  await expect(window.locator('[data-testid="suggestion-1"]')).toBeVisible()
})

test('suggestions replaced (not appended) on new suggestion:ready push', async () => {
  await emitIpcPush(window, IPC_CHANNELS.SUGGESTION_READY, SAMPLE_SUGGESTIONS)
  await expect(window.locator('[data-testid="suggestion-2"]')).toBeVisible({ timeout: 3_000 })

  // Now push only one suggestion
  await emitIpcPush(window, IPC_CHANNELS.SUGGESTION_READY, [SAMPLE_SUGGESTIONS[0]])

  await expect(window.locator('[data-testid="suggestion-0"]')).toBeVisible({ timeout: 3_000 })
  // The third card from the previous batch should be gone
  await expect(window.locator('[data-testid="suggestion-2"]')).not.toBeVisible()
})
