import type { AuthState } from '../../domain/models/auth-state'
import { createInvalidAuthState } from '../../domain/models/auth-state'
import type { IKeychainService } from './validate-api-key-use-case'

const KEYCHAIN_SERVICE = 'claude-project-manager'
const KEYCHAIN_ACCOUNT_API_KEY = 'api-key'
const KEYCHAIN_ACCOUNT_SESSION = 'claude-account-session'

export interface SignOutResult {
  authState: AuthState
}

export async function signOut(params: { keychainService: IKeychainService }): Promise<SignOutResult> {
  const { keychainService } = params
  // Delete both possible credentials
  await Promise.all([
    keychainService.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_API_KEY),
    keychainService.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_SESSION),
  ])
  return { authState: createInvalidAuthState(false) }
}
