import { createServer, type Server } from 'http'
import { randomBytes, createHash } from 'crypto'
import { shell } from 'electron'
import log from 'electron-log'

// These are Anthropic's OAuth endpoints for Claude account sign-in.
// The client ID is the public identifier for this desktop application.
const AUTHORIZATION_URL = 'https://claude.ai/oauth/authorize'
const TOKEN_URL = 'https://api.anthropic.com/oauth/token'
const CLIENT_ID = 'claude-config-studio'
const SCOPES = 'user:inference'
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export interface OAuthTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export async function startClaudeOAuthFlow(): Promise<OAuthTokens> {
  return new Promise((resolve, reject) => {
    let server: Server | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let redirectUri = ''
    let codeVerifier = ''
    let state = ''

    function cleanup(): void {
      if (timeoutId) clearTimeout(timeoutId)
      if (server) server.close()
    }

    server = createServer((req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404)
        res.end()
        return
      }
      const url = new URL(req.url, 'http://localhost')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      const returnedState = url.searchParams.get('state')

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body><h1>Authentication complete. You can close this tab.</h1></body></html>')

      if (error || !code) {
        cleanup()
        reject(new Error(error ?? 'No authorization code received'))
        return
      }
      if (returnedState !== state) {
        cleanup()
        reject(new Error('OAuth state mismatch — possible CSRF attack'))
        return
      }

      exchangeCodeForTokens(code, redirectUri, codeVerifier)
        .then((tokens) => {
          cleanup()
          resolve(tokens)
        })
        .catch((err) => {
          cleanup()
          reject(err)
        })
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address()
      if (!addr || typeof addr === 'string') {
        cleanup()
        reject(new Error('Failed to determine local server port'))
        return
      }
      const port = addr.port
      redirectUri = `http://127.0.0.1:${port}/callback`
      codeVerifier = generateCodeVerifier()
      const codeChallenge = generateCodeChallenge(codeVerifier)
      state = randomBytes(16).toString('hex')

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        scope: SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      })

      const authUrl = `${AUTHORIZATION_URL}?${params.toString()}`
      log.info({ component: 'claude-oauth-server', op: 'open-browser', port })
      shell.openExternal(authUrl)

      timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('Claude account sign-in timed out (5 minutes)'))
      }, CALLBACK_TIMEOUT_MS)
    })

    server.on('error', (err) => {
      cleanup()
      reject(err)
    })
  })
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<OAuthTokens> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }).toString(),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Token exchange failed: ${response.status} ${body}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await response.json()) as any
  const expiresAt = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000)
    : null

  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string | undefined) ?? null,
    expiresAt,
  }
}
