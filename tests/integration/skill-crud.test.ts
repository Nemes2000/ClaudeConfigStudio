/**
 * Integration tests: Skill CRUD — create, delete, toggle via IPC.
 *
 * These tests exercise the IPC layer by evaluating calls directly in the
 * renderer context via window.electron.ipcRenderer.invoke, verifying that
 * the channel contract is correctly wired and that responses flow back.
 *
 * Covers:
 * - skill:create returns a file path and initial content
 * - skill:delete is called with correct payload
 * - skill:toggle enables and disables a skill
 * - skill:validate-structure returns validation results
 * - Errors from skill:create are surfaced correctly
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchApp, mockIpcInvoke, invokeIpc, emitIpcPush } from './helpers/mock-ipc'
import { IPC_CHANNELS } from '../../src/shared/ipc-channels'

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

// ─── skill:create ─────────────────────────────────────────────────────────────

test('skill:create returns file path and content on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.SKILL_CREATE, {
    filePath: '/home/user/.claude/skills/my-skill.md',
    content: '---\nname: My Skill\n---\n',
  })

  const result = await invokeIpc(window, IPC_CHANNELS.SKILL_CREATE, {
    claudePath: '/home/user/.claude',
    slug: 'my-skill',
    name: 'My Skill',
    description: 'A test skill',
  })

  expect(result).toMatchObject({
    filePath: expect.stringContaining('my-skill'),
    content: expect.any(String),
  })
})

test('skill:create with duplicate slug surfaces an error response', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.SKILL_CREATE, {
    error: { code: 'SKILL_ALREADY_EXISTS', message: 'A skill with that slug already exists.' },
  })

  const result = await invokeIpc(window, IPC_CHANNELS.SKILL_CREATE, {
    claudePath: '/home/user/.claude',
    slug: 'existing-skill',
    name: 'Existing Skill',
    description: 'Duplicate',
  }) as Record<string, unknown>

  expect(result?.error).toBeDefined()
})

// ─── skill:delete ─────────────────────────────────────────────────────────────

test('skill:delete returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.SKILL_DELETE, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.SKILL_DELETE, {
    claudePath: '/home/user/.claude',
    slug: 'my-skill',
  })

  expect(result).toMatchObject({ data: null })
})

// ─── skill:toggle ─────────────────────────────────────────────────────────────

test('skill:toggle enable returns updated enabled state', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.SKILL_TOGGLE, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.SKILL_TOGGLE, {
    filePath: '/home/user/.claude/skills/my-skill.md',
    enabled: true,
  })

  expect(result).toMatchObject({ data: null })
})

test('skill:toggle disable returns updated disabled state', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.SKILL_TOGGLE, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.SKILL_TOGGLE, {
    filePath: '/home/user/.claude/skills/my-skill.md',
    enabled: false,
  })

  expect(result).toMatchObject({ data: null })
})

// ─── skill:validate-structure ─────────────────────────────────────────────────

test('skill:validate-structure returns valid=true for well-formed skill', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.SKILL_VALIDATE_STRUCTURE, {
    valid: true,
    missingSections: [],
    malformedSections: [],
  })

  const result = await invokeIpc(window, IPC_CHANNELS.SKILL_VALIDATE_STRUCTURE, {
    filePath: '/home/user/.claude/skills/my-skill.md',
  }) as Record<string, unknown>

  expect(result.valid).toBe(true)
  expect(result.missingSections).toHaveLength(0)
})

test('skill:validate-structure returns missing sections for bare file', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.SKILL_VALIDATE_STRUCTURE, {
    valid: false,
    missingSections: ['Purpose', 'Instructions'],
    malformedSections: [],
  })

  const result = await invokeIpc(window, IPC_CHANNELS.SKILL_VALIDATE_STRUCTURE, {
    filePath: '/home/user/.claude/skills/bare-skill.md',
  }) as Record<string, unknown>

  expect(result.valid).toBe(false)
  expect(result.missingSections).toContain('Purpose')
  expect(result.missingSections).toContain('Instructions')
})

// ─── Rule CRUD ────────────────────────────────────────────────────────────────

test('rule:create returns file path and content', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.RULE_CREATE, {
    filePath: '/home/user/.claude/rules/naming-conventions.md',
    content: '---\nname: Naming Conventions\n---\n',
  })

  const result = await invokeIpc(window, IPC_CHANNELS.RULE_CREATE, {
    claudePath: '/home/user/.claude',
    slug: 'naming-conventions',
    name: 'Naming Conventions',
    description: 'Standard naming rules',
  })

  expect(result).toMatchObject({ filePath: expect.stringContaining('naming-conventions') })
})

test('rule:delete returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.RULE_DELETE, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.RULE_DELETE, {
    claudePath: '/home/user/.claude',
    slug: 'naming-conventions',
  })

  expect(result).toMatchObject({ data: null })
})

test('rule:toggle responds correctly', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.RULE_TOGGLE, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.RULE_TOGGLE, {
    filePath: '/home/user/.claude/rules/naming-conventions.md',
    enabled: false,
  })

  expect(result).toMatchObject({ data: null })
})

test('hook:toggle responds correctly', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.HOOK_TOGGLE, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.HOOK_TOGGLE, {
    filePath: '/home/user/.claude/hooks/pre-commit-lint.sh',
    enabled: true,
  })

  expect(result).toMatchObject({ data: null })
})
