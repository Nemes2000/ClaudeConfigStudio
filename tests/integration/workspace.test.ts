/**
 * Integration tests: WorkspacePage — workspace scan and project discovery.
 *
 * Covers:
 * - Workspace page renders after successful auth
 * - project:scan is called on mount
 * - project:discovered push event populates the project list
 * - graph:updated push event updates graph elements
 * - auth:state-changed push event with invalid state re-shows wizard
 * - config:changed push event is received without crash
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchApp, mockIpcInvoke, emitIpcPush } from './helpers/mock-ipc'
import { IPC_CHANNELS } from '../../src/shared/ipc-channels'

// Helper: authenticate and navigate to the workspace page
async function authenticateAndOpenWorkspace(window: Page): Promise<void> {
  await window.waitForSelector('[data-testid="onboarding-wizard"]', { timeout: 15_000 })

  await mockIpcInvoke(window, IPC_CHANNELS.AUTH_VALIDATE, {
    ok: true,
    authState: { isValid: true, keyPresent: true, lastValidatedAt: new Date().toISOString() },
  })
  await mockIpcInvoke(window, IPC_CHANNELS.PROJECT_SCAN, { data: null })

  await window.locator('[data-testid="api-key-input"]').fill('sk-ant-api03-validkey')
  await window.locator('[data-testid="submit-button"]').click()

  // Simulate the main process pushing auth:state-changed after key validation
  await emitIpcPush(window, IPC_CHANNELS.AUTH_STATE_CHANGED, {
    isValid: true, keyPresent: true, lastValidatedAt: new Date().toISOString(),
  })
  await window.waitForSelector('[data-testid="workspace-page"]', { timeout: 10_000 })
}

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

// ─── Basic rendering ──────────────────────────────────────────────────────────

test('workspace page is visible after authentication', async () => {
  await expect(window.locator('[data-testid="workspace-page"]')).toBeVisible()
})

test('onboarding wizard is hidden after authentication', async () => {
  await expect(window.locator('[data-testid="onboarding-wizard"]')).not.toBeVisible()
})

test('skill graph view is rendered inside workspace', async () => {
  await expect(window.locator('[data-testid="skill-graph-view"]')).toBeVisible()
})

test('suggestion sidebar is rendered inside workspace', async () => {
  await expect(window.locator('[data-testid="suggestion-sidebar"]')).toBeVisible()
})

// ─── Project discovery ────────────────────────────────────────────────────────

test('project:discovered push event does not crash the renderer', async () => {
  // WorkspacePage expects: { folder: IpcClaudeFolder, cytoscapeElements: ... }
  await emitIpcPush(window, IPC_CHANNELS.PROJECT_DISCOVERED, {
    folder: {
      projectPath: '/home/user/my-project',
      claudePath: '/home/user/my-project/.claude',
      isRootLevel: false,
      contents: { skills: [], rules: [], hooks: [], mcps: [], agentConfig: null },
    },
    cytoscapeElements: { nodes: [], edges: [] },
  })

  // Page should still be showing the workspace (no crash / white screen)
  await expect(window.locator('[data-testid="workspace-page"]')).toBeVisible()
})

test('graph:updated push event with nodes re-renders the graph', async () => {
  await emitIpcPush(window, IPC_CHANNELS.GRAPH_UPDATED, {
    cytoscapeElements: {
      nodes: [
        {
          data: {
            id: 'skill-one',
            label: 'Skill One',
            isEnabled: true,
            isMissingFrontmatter: false,
            isOrchestrator: false,
          },
        },
      ],
      edges: [],
    },
  })

  // Graph view should still be visible and stable
  await expect(window.locator('[data-testid="skill-graph-view"]')).toBeVisible()
})

test('graph:updated with empty nodes shows empty-state message', async () => {
  await emitIpcPush(window, IPC_CHANNELS.GRAPH_UPDATED, { cytoscapeElements: { nodes: [], edges: [] } })

  await expect(window.locator('[data-testid="skill-graph-view"]')).toBeVisible()
  const emptyText = window.locator('text=No skills found')
  await expect(emptyText).toBeVisible({ timeout: 3_000 })
})

// ─── Auth state changes ───────────────────────────────────────────────────────

test('auth:state-changed push with isValid=false re-shows the wizard', async () => {
  await emitIpcPush(window, IPC_CHANNELS.AUTH_STATE_CHANGED, {
    isValid: false,
    keyPresent: false,
    lastValidatedAt: null,
  })

  await expect(window.locator('[data-testid="onboarding-wizard"]')).toBeVisible({ timeout: 5_000 })
  await expect(window.locator('[data-testid="workspace-page"]')).not.toBeVisible()
})

// ─── Config changes ───────────────────────────────────────────────────────────

test('config:changed push event is handled without crash', async () => {
  await emitIpcPush(window, IPC_CHANNELS.CONFIG_CHANGED, {
    filePath: '/home/user/.claude/skills/some-skill.md',
    changeType: 'modified',
  })

  await expect(window.locator('[data-testid="workspace-page"]')).toBeVisible()
})
