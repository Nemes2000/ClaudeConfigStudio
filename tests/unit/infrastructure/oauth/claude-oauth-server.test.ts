/**
 * Unit tests for claude-oauth-server authorization URL construction.
 * We cannot run a real OAuth flow in unit tests (no browser, no Anthropic server),
 * so we verify the URL built before shell.openExternal is called.
 */

// Mock Electron APIs before importing the module under test
jest.mock('electron', () => ({
  shell: { openExternal: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('electron-log', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  info: jest.fn(),
}))

import { shell } from 'electron'
import http from 'http'

const mockShell = shell as jest.Mocked<typeof shell>

describe('startClaudeOAuthFlow — authorization URL', () => {
  let capturedUrl: URL

  beforeEach(() => {
    jest.clearAllMocks()
    capturedUrl = undefined as unknown as URL

    mockShell.openExternal.mockImplementation(async (url: string) => {
      capturedUrl = new URL(url)
    })
  })

  function startFlow(): { promise: Promise<unknown>; abort: () => void } {
    // Dynamically import so the mock is in place each time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { startClaudeOAuthFlow } = require('../../../../src/main/infrastructure/oauth/claude-oauth-server')
    const promise = startClaudeOAuthFlow()

    // Give the local HTTP server time to start and call openExternal
    const abort = () => promise.catch(() => {/* expected rejection */})
    return { promise, abort }
  }

  it('opens the correct authorization endpoint', async () => {
    const { abort } = startFlow()
    await new Promise((r) => setTimeout(r, 100))

    expect(capturedUrl).toBeDefined()
    expect(capturedUrl.origin + capturedUrl.pathname).toBe('https://claude.ai/oauth/authorize')
    abort()
  })

  it('requests only the user:inference scope (not openid/email/profile)', async () => {
    const { abort } = startFlow()
    await new Promise((r) => setTimeout(r, 100))

    expect(capturedUrl).toBeDefined()
    const scope = capturedUrl.searchParams.get('scope')
    expect(scope).toBe('user:inference')
    expect(scope).not.toContain('openid')
    expect(scope).not.toContain('email')
    expect(scope).not.toContain('profile')
    abort()
  })

  it('uses PKCE with S256 code_challenge_method', async () => {
    const { abort } = startFlow()
    await new Promise((r) => setTimeout(r, 100))

    expect(capturedUrl).toBeDefined()
    expect(capturedUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(capturedUrl.searchParams.get('code_challenge')).toBeTruthy()
    expect(capturedUrl.searchParams.get('code_verifier')).toBeNull() // verifier must NOT be in the URL
    abort()
  })

  it('includes a state parameter for CSRF protection', async () => {
    const { abort } = startFlow()
    await new Promise((r) => setTimeout(r, 100))

    expect(capturedUrl).toBeDefined()
    const state = capturedUrl.searchParams.get('state')
    expect(state).toBeTruthy()
    expect(state!.length).toBeGreaterThan(8)
    abort()
  })

  it('sets response_type=code', async () => {
    const { abort } = startFlow()
    await new Promise((r) => setTimeout(r, 100))

    expect(capturedUrl).toBeDefined()
    expect(capturedUrl.searchParams.get('response_type')).toBe('code')
    abort()
  })

  it('uses a localhost redirect_uri', async () => {
    const { abort } = startFlow()
    await new Promise((r) => setTimeout(r, 100))

    expect(capturedUrl).toBeDefined()
    const redirectUri = capturedUrl.searchParams.get('redirect_uri')
    expect(redirectUri).toBeTruthy()
    expect(redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/)
    abort()
  })

  afterEach(() => {
    // Allow open handles (the local HTTP server) to drain
    jest.useRealTimers()
  })
})
