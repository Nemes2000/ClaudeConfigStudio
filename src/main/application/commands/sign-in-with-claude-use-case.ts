import type { AuthState } from '../../domain/models/auth-state'
import { createValidAuthState, createInvalidAuthState } from '../../domain/models/auth-state'
import { startClaudeOAuthFlow } from '../../infrastructure/oauth/claude-oauth-server'
import type { IKeychainService } from './validate-api-key-use-case'

const KEYCHAIN_SERVICE = 'claude-project-manager'
const KEYCHAIN_ACCOUNT_SESSION = 'claude-account-session'

export interface SignInWithClaudeResult {
  authState: AuthState
  reason: 'success' | 'cancelled' | 'error'
  message?: string
}

export async function signInWithClaude(params: {
  keychainService: IKeychainService
}): Promise<SignInWithClaudeResult> {
  const { keychainService } = params
  try {
    const tokens = await startClaudeOAuthFlow()
    // Store the access token in keychain
    await keychainService.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_SESSION, tokens.accessToken)
    return {
      authState: createValidAuthState('claude-account'),
      reason: 'success',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isCancelled = message.toLowerCase().includes('cancel') || message.toLowerCase().includes('timed out')
    return {
      authState: createInvalidAuthState(false),
      reason: isCancelled ? 'cancelled' : 'error',
      message,
    }
  }
}

export async function getClaudeAccountSession(params: {
  keychainService: IKeychainService
}): Promise<string | null> {
  return params.keychainService.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_SESSION)
}

export async function deleteClaudeAccountSession(params: {
  keychainService: IKeychainService
}): Promise<void> {
  await params.keychainService.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_SESSION)
}
