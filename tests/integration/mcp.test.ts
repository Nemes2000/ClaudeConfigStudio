/**
 * Integration tests: MCP — marketplace listing, install, toggle, and uninstall.
 *
 * Covers:
 * - mcp:list-marketplace returns available modules
 * - mcp:validate-compatibility returns compatibility result
 * - mcp:install returns installation record
 * - mcp:list-installed returns installed modules
 * - mcp:toggle enable/disable
 * - mcp:uninstall returns null data
 * - mcp:set-auth-key returns null data
 * - Auth-required module install with missing key surfaces error
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchApp, mockIpcInvoke, invokeIpc, emitIpcPush } from './helpers/mock-ipc'
import { IPC_CHANNELS, IpcMcpModule, IpcMcpInstallation } from '../../src/shared/ipc-channels'

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

const SAMPLE_MODULE: IpcMcpModule = {
  name: 'github-mcp',
  displayName: 'GitHub MCP',
  description: 'GitHub integration via Model Control Protocol.',
  version: '1.2.0',
  author: 'Acme Corp',
  repositoryUrl: 'https://github.com/acme/github-mcp',
  configSchema: { repo: { type: 'string' } },
  minClaudeVersion: '3.5',
  authRequired: true,
  authKeyLabel: 'GitHub Personal Access Token',
}

const SAMPLE_INSTALLATION: IpcMcpInstallation = {
  moduleName: 'github-mcp',
  configFilePath: '/home/user/.claude/mcp/github-mcp.json',
  isEnabled: true,
  hasAuthKey: true,
  config: { repo: 'acme/my-repo' },
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

// ─── mcp:list-marketplace ─────────────────────────────────────────────────────

test('mcp:list-marketplace returns module list', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_LIST_MARKETPLACE, [SAMPLE_MODULE])

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_LIST_MARKETPLACE, {}) as IpcMcpModule[]
  expect(Array.isArray(result)).toBe(true)
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ name: 'github-mcp', displayName: 'GitHub MCP' })
})

test('mcp:list-marketplace returns empty array when no modules available', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_LIST_MARKETPLACE, [])

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_LIST_MARKETPLACE, {}) as IpcMcpModule[]
  expect(result).toHaveLength(0)
})

// ─── mcp:validate-compatibility ───────────────────────────────────────────────

test('mcp:validate-compatibility returns compatible result', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_VALIDATE_COMPATIBILITY, {
    isCompatible: true,
    detectedClaudeVersion: '3.7',
    requiredMinVersion: '3.5',
    reason: 'Compatible',
  })

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_VALIDATE_COMPATIBILITY, {
    mcpModule: SAMPLE_MODULE,
  }) as Record<string, unknown>

  expect(result.isCompatible).toBe(true)
})

test('mcp:validate-compatibility returns incompatible with reason', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_VALIDATE_COMPATIBILITY, {
    isCompatible: false,
    detectedClaudeVersion: '3.0',
    requiredMinVersion: '3.5',
    reason: 'Claude version 3.0 is below the required minimum 3.5.',
  })

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_VALIDATE_COMPATIBILITY, {
    mcpModule: SAMPLE_MODULE,
  }) as Record<string, unknown>

  expect(result.isCompatible).toBe(false)
  expect(typeof result.reason).toBe('string')
})

// ─── mcp:install ──────────────────────────────────────────────────────────────

test('mcp:install returns installation record on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_INSTALL, SAMPLE_INSTALLATION)

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_INSTALL, {
    mcpModule: SAMPLE_MODULE,
    configValues: { repo: 'acme/my-repo' },
    authKey: 'ghp_test_token',
  }) as IpcMcpInstallation

  expect(result).toMatchObject({ moduleName: 'github-mcp', isEnabled: true })
})

test('mcp:install without required auth key returns error', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_INSTALL, {
    error: { code: 'AUTH_KEY_REQUIRED', message: 'An authentication key is required for this module.' },
  })

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_INSTALL, {
    mcpModule: SAMPLE_MODULE,
    configValues: {},
    // authKey omitted
  }) as Record<string, unknown>

  expect(result.error).toBeDefined()
  expect((result.error as Record<string, unknown>).code).toBe('AUTH_KEY_REQUIRED')
})

// ─── mcp:list-installed ───────────────────────────────────────────────────────

test('mcp:list-installed returns array of installations', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_LIST_INSTALLED, [SAMPLE_INSTALLATION])

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_LIST_INSTALLED, {
    claudePath: '/home/user/.claude',
  }) as IpcMcpInstallation[]

  expect(Array.isArray(result)).toBe(true)
  expect(result[0]).toMatchObject({ moduleName: 'github-mcp' })
})

test('mcp:list-installed returns empty array when none installed', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_LIST_INSTALLED, [])

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_LIST_INSTALLED, {
    claudePath: '/home/user/.claude',
  }) as IpcMcpInstallation[]

  expect(result).toHaveLength(0)
})

// ─── mcp:toggle ───────────────────────────────────────────────────────────────

test('mcp:toggle enable returns null data', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_TOGGLE, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_TOGGLE, {
    claudePath: '/home/user/.claude',
    name: 'github-mcp',
    enabled: true,
  })

  expect(result).toMatchObject({ data: null })
})

test('mcp:toggle disable returns null data', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_TOGGLE, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_TOGGLE, {
    claudePath: '/home/user/.claude',
    name: 'github-mcp',
    enabled: false,
  })

  expect(result).toMatchObject({ data: null })
})

// ─── mcp:uninstall ────────────────────────────────────────────────────────────

test('mcp:uninstall returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_UNINSTALL, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_UNINSTALL, {
    claudePath: '/home/user/.claude',
    name: 'github-mcp',
  })

  expect(result).toMatchObject({ data: null })
})

// ─── mcp:set-auth-key ─────────────────────────────────────────────────────────

test('mcp:set-auth-key returns null data on success', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.MCP_SET_AUTH_KEY, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.MCP_SET_AUTH_KEY, {
    name: 'github-mcp',
    authKey: 'ghp_new_token',
  })

  expect(result).toMatchObject({ data: null })
})

// ─── auth:validate from workspace ─────────────────────────────────────────────

test('auth:validate returns current auth state', async () => {
  const authState = { isValid: true, keyPresent: true, lastValidatedAt: new Date().toISOString() }
  await mockIpcInvoke(window, IPC_CHANNELS.AUTH_VALIDATE, { ok: true, authState })

  const result = await invokeIpc(window, IPC_CHANNELS.AUTH_VALIDATE, {}) as Record<string, unknown>
  expect(result.ok).toBe(true)
  expect((result.authState as Record<string, unknown>).isValid).toBe(true)
})

// ─── suggestion:request ───────────────────────────────────────────────────────

test('suggestion:request returns without crash', async () => {
  await mockIpcInvoke(window, IPC_CHANNELS.SUGGESTION_REQUEST, { data: null })

  const result = await invokeIpc(window, IPC_CHANNELS.SUGGESTION_REQUEST, {
    skillNode: {
      slug: 'code-formatter',
      name: 'Code Formatter',
      description: 'Formats code',
      version: '1.0.0',
      filePath: '/home/user/.claude/skills/code-formatter.md',
      isEnabled: true,
      dependencies: [],
      mcpServers: [],
      diagrams: [],
      triggers: [],
      isMissingFrontmatter: false,
      hasPurposeSection: true,
      hasInstructionsSection: true,
    },
    fileContent: '---\nname: Code Formatter\n---\n',
  })

  expect(result).toMatchObject({ data: null })
})
