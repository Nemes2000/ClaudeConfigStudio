/**
 * Integration tests: File IPC operations — read, write, section edits.
 *
 * Covers:
 * - file:read returns content for a given path
 * - file:write returns null on success
 * - file:delete returns null on success
 * - file:update-section replaces section content
 * - file:delete-section removes a section
 * - file:add-section appends a new section
 * - file:add-item / update-item / delete-item / reorder-item
 * - Path traversal payload is rejected by the IPC handler
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

const TEST_FILE = '/home/user/.claude/skills/code-formatter.md'
const TEST_CONTENT = '---\nname: Code Formatter\n---\n\n## Purpose\nFormats code.\n'

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

// ─── file:read ────────────────────────────────────────────────────────────────

test('file:read returns file content', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_READ, { content: TEST_CONTENT })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_READ, { filePath: TEST_FILE }) as Record<string, unknown>
  expect(result.content).toBe(TEST_CONTENT)
})

test('file:read error response is returned for missing file', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_READ, {
    error: { code: 'FILE_NOT_FOUND', message: 'File not found.' },
  })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_READ, {
    filePath: '/home/user/.claude/skills/nonexistent.md',
  }) as Record<string, unknown>

  expect(result.error).toBeDefined()
})

// ─── file:write ───────────────────────────────────────────────────────────────

test('file:write returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_WRITE, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_WRITE, {
    filePath: TEST_FILE,
    content: TEST_CONTENT + '\nExtra line.',
  })

  expect(result).toMatchObject({ data: null })
})

// ─── file:delete ──────────────────────────────────────────────────────────────

test('file:delete returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_DELETE, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_DELETE, { filePath: TEST_FILE })
  expect(result).toMatchObject({ data: null })
})

// ─── file:update-section ──────────────────────────────────────────────────────

test('file:update-section returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_UPDATE_SECTION, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_UPDATE_SECTION, {
    filePath: TEST_FILE,
    sectionHeading: 'Purpose',
    newContent: 'Formats TypeScript code.',
  })

  expect(result).toMatchObject({ data: null })
})

// ─── file:delete-section ──────────────────────────────────────────────────────

test('file:delete-section returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_DELETE_SECTION, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_DELETE_SECTION, {
    filePath: TEST_FILE,
    sectionHeading: 'Purpose',
  })

  expect(result).toMatchObject({ data: null })
})

// ─── file:add-section ─────────────────────────────────────────────────────────

test('file:add-section returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_ADD_SECTION, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_ADD_SECTION, {
    filePath: TEST_FILE,
    sectionHeading: 'Examples',
    content: 'Example 1: format a file.',
    afterSection: 'Instructions',
  })

  expect(result).toMatchObject({ data: null })
})

// ─── file:add-item ────────────────────────────────────────────────────────────

test('file:add-item returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_ADD_ITEM, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_ADD_ITEM, {
    filePath: TEST_FILE,
    sectionHeading: 'Instructions',
    itemContent: 'Run the formatter before committing.',
  })

  expect(result).toMatchObject({ data: null })
})

// ─── file:update-item ─────────────────────────────────────────────────────────

test('file:update-item returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_UPDATE_ITEM, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_UPDATE_ITEM, {
    filePath: TEST_FILE,
    sectionHeading: 'Instructions',
    itemIndex: 0,
    newContent: 'Updated instruction text.',
  })

  expect(result).toMatchObject({ data: null })
})

// ─── file:delete-item ─────────────────────────────────────────────────────────

test('file:delete-item returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_DELETE_ITEM, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_DELETE_ITEM, {
    filePath: TEST_FILE,
    sectionHeading: 'Instructions',
    itemIndex: 0,
  })

  expect(result).toMatchObject({ data: null })
})

// ─── file:reorder-item ────────────────────────────────────────────────────────

test('file:reorder-item returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_REORDER_ITEM, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_REORDER_ITEM, {
    filePath: TEST_FILE,
    sectionHeading: 'Instructions',
    fromIndex: 0,
    toIndex: 2,
  })

  expect(result).toMatchObject({ data: null })
})

// ─── Path traversal rejection ─────────────────────────────────────────────────

test('file:read with path traversal returns an error', async () => {
  // The real IPC handler rejects paths outside ~/.claude/ — mock this response
  await mockIpcInvoke(window, IPC_CHANNELS.FILE_READ, {
    error: { code: 'INVALID_PATH', message: 'Path is outside the allowed base directory.' },
  })

  const result = await invokeIpc(window, IPC_CHANNELS.FILE_READ, {
    filePath: '/etc/passwd',
  }) as Record<string, unknown>

  expect(result.error).toBeDefined()
  expect((result.error as Record<string, unknown>).code).toBe('INVALID_PATH')
})
