/**
 * Integration tests: SkillGraphView — graph rendering and interactions.
 *
 * Covers:
 * - Empty state message when no skills exist
 * - Skill nodes rendered after graph:updated push
 * - Disabled skills rendered with reduced opacity
 * - Warning badge shown for skills with missing frontmatter
 * - Clicking a node selects it
 * - Multiple nodes rendered correctly
 * - Edges between nodes (broken and healthy) handled without crash
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchApp, mockIpcInvoke, emitIpcPush } from './helpers/mock-ipc'
import { IPC_CHANNELS, IpcCytoscapeElements } from '../../src/shared/ipc-channels'

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

async function pushGraph(window: Page, elements: IpcCytoscapeElements): Promise<void> {
  // WorkspacePage expects: { cytoscapeElements: IpcCytoscapeElements }
  await emitIpcPush(window, IPC_CHANNELS.GRAPH_UPDATED, { cytoscapeElements: elements })
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

// ─── Empty state ──────────────────────────────────────────────────────────────

test('empty state message is shown when graph has no nodes', async () => {
  await pushGraph(window, { nodes: [], edges: [] })

  const view = window.locator('[data-testid="skill-graph-view"]')
  await expect(view).toBeVisible()
  await expect(view.locator('text=No skills found')).toBeVisible({ timeout: 3_000 })
})

// ─── Node rendering ───────────────────────────────────────────────────────────

test('single enabled node is rendered in the graph', async () => {
  await pushGraph(window, {
    nodes: [
      {
        data: {
          id: 'code-formatter',
          label: 'Code Formatter',
          isEnabled: true,
          isMissingFrontmatter: false,
          isOrchestrator: false,
        },
      },
    ],
    edges: [],
  })

  const nodeList = window.locator('[data-testid="graph-node-list"]')
  await expect(nodeList).toBeVisible({ timeout: 3_000 })

  const node = window.locator('[data-testid="graph-node-code-formatter"]')
  await expect(node).toBeVisible()
  await expect(node).toContainText('Code Formatter')
})

test('multiple nodes are all rendered', async () => {
  await pushGraph(window, {
    nodes: [
      { data: { id: 'skill-a', label: 'Skill A', isEnabled: true, isMissingFrontmatter: false, isOrchestrator: false } },
      { data: { id: 'skill-b', label: 'Skill B', isEnabled: true, isMissingFrontmatter: false, isOrchestrator: false } },
      { data: { id: 'skill-c', label: 'Skill C', isEnabled: true, isMissingFrontmatter: false, isOrchestrator: false } },
    ],
    edges: [],
  })

  await expect(window.locator('[data-testid="graph-node-skill-a"]')).toBeVisible({ timeout: 3_000 })
  await expect(window.locator('[data-testid="graph-node-skill-b"]')).toBeVisible()
  await expect(window.locator('[data-testid="graph-node-skill-c"]')).toBeVisible()
})

// ─── Disabled nodes ───────────────────────────────────────────────────────────

test('disabled node is rendered with reduced opacity', async () => {
  await pushGraph(window, {
    nodes: [
      {
        data: {
          id: 'disabled-skill',
          label: 'Disabled Skill',
          isEnabled: false,
          isMissingFrontmatter: false,
          isOrchestrator: false,
        },
      },
    ],
    edges: [],
  })

  const node = window.locator('[data-testid="graph-node-disabled-skill"]')
  await expect(node).toBeVisible({ timeout: 3_000 })

  // Disabled skills should have opacity applied (0.35)
  const opacity = await node.evaluate((el) => parseFloat(getComputedStyle(el).opacity))
  expect(opacity).toBeLessThan(1)
})

// ─── Warning badge ────────────────────────────────────────────────────────────

test('warning badge is shown for node with missing frontmatter', async () => {
  await pushGraph(window, {
    nodes: [
      {
        data: {
          id: 'bad-skill',
          label: 'Bad Skill',
          isEnabled: true,
          isMissingFrontmatter: true,
          isOrchestrator: false,
        },
      },
    ],
    edges: [],
  })

  const node = window.locator('[data-testid="graph-node-bad-skill"]')
  await expect(node).toBeVisible({ timeout: 3_000 })

  const badge = node.locator('[data-testid="warning-badge"]')
  await expect(badge).toBeVisible()
})

test('no warning badge for node with complete frontmatter', async () => {
  await pushGraph(window, {
    nodes: [
      {
        data: {
          id: 'good-skill',
          label: 'Good Skill',
          isEnabled: true,
          isMissingFrontmatter: false,
          isOrchestrator: false,
        },
      },
    ],
    edges: [],
  })

  const node = window.locator('[data-testid="graph-node-good-skill"]')
  await expect(node).toBeVisible({ timeout: 3_000 })
  await expect(node.locator('[data-testid="warning-badge"]')).not.toBeVisible()
})

// ─── Node interaction ─────────────────────────────────────────────────────────

test('clicking a node does not crash the renderer', async () => {
  await pushGraph(window, {
    nodes: [
      { data: { id: 'click-skill', label: 'Clickable', isEnabled: true, isMissingFrontmatter: false, isOrchestrator: false } },
    ],
    edges: [],
  })

  const node = window.locator('[data-testid="graph-node-click-skill"]')
  await expect(node).toBeVisible({ timeout: 3_000 })
  await node.click()

  // After click the graph should still be showing
  await expect(window.locator('[data-testid="skill-graph-view"]')).toBeVisible()
})

// ─── Edges ────────────────────────────────────────────────────────────────────

test('graph with edges between nodes renders without crash', async () => {
  await pushGraph(window, {
    nodes: [
      { data: { id: 'parent', label: 'Parent', isEnabled: true, isMissingFrontmatter: false, isOrchestrator: true } },
      { data: { id: 'child', label: 'Child', isEnabled: true, isMissingFrontmatter: false, isOrchestrator: false } },
    ],
    edges: [
      { data: { id: 'e1', source: 'parent', target: 'child', isBroken: false } },
    ],
  })

  await expect(window.locator('[data-testid="graph-node-parent"]')).toBeVisible({ timeout: 3_000 })
  await expect(window.locator('[data-testid="graph-node-child"]')).toBeVisible()
})

test('broken edge (missing dependency) renders without crash', async () => {
  await pushGraph(window, {
    nodes: [
      { data: { id: 'orphan', label: 'Orphan', isEnabled: true, isMissingFrontmatter: false, isOrchestrator: false } },
    ],
    edges: [
      { data: { id: 'broken-edge', source: 'orphan', target: 'missing-skill', isBroken: true } },
    ],
  })

  await expect(window.locator('[data-testid="graph-node-orphan"]')).toBeVisible({ timeout: 3_000 })
  await expect(window.locator('[data-testid="skill-graph-view"]')).toBeVisible()
})

// ─── Successive updates ───────────────────────────────────────────────────────

test('graph handles multiple successive graph:updated push events', async () => {
  for (let i = 0; i < 3; i++) {
    await pushGraph(window, {
      nodes: [
        { data: { id: `skill-${i}`, label: `Skill ${i}`, isEnabled: true, isMissingFrontmatter: false, isOrchestrator: false } },
      ],
      edges: [],
    })
  }

  // Final state should show the last graph
  await expect(window.locator('[data-testid="graph-node-skill-2"]')).toBeVisible({ timeout: 3_000 })
  await expect(window.locator('[data-testid="skill-graph-view"]')).toBeVisible()
})
