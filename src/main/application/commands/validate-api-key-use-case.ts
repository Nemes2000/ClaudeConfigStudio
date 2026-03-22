import type { AuthState } from '../../domain/models/auth-state'
import {
  createValidAuthState,
  createInvalidAuthState,
} from '../../domain/models/auth-state'

export interface IKeychainService {
  getPassword(service: string, account: string): Promise<string | null>
  setPassword(service: string, account: string, password: string): Promise<void>
  deletePassword(service: string, account: string): Promise<void>
}

export interface IAnthropicClient {
  validateKey(apiKey: string): Promise<boolean>
}

const KEYCHAIN_SERVICE = 'claude-project-manager'
const KEYCHAIN_ACCOUNT = 'api-key'

export interface ValidateApiKeyParams {
  keychainService: IKeychainService
  anthropicClient: IAnthropicClient
  /** Provided on explicit user submission from OnboardingWizard */
  apiKey?: string
}

export interface ValidateApiKeyResult {
  authState: AuthState
  reason: 'startup' | 'key-submitted' | 'api-401' | 'network-error'
}

/**
 * Validates the Claude API key. On user submission, stores the key first,
 * then validates. On 401, deletes the stored key.
 */
export async function validateApiKey(
  params: ValidateApiKeyParams,
): Promise<ValidateApiKeyResult> {
  const { keychainService, anthropicClient, apiKey } = params

  let key: string | null = apiKey ?? null

  if (apiKey) {
    // Store before validation (delete on 401)
    await keychainService.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, apiKey)
  } else {
    // Read from keychain
    key = await keychainService.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
  }

  if (!key) {
    return {
      authState: createInvalidAuthState(false),
      reason: 'startup',
    }
  }

  let isValid: boolean
  let isAuthError = false

  try {
    isValid = await anthropicClient.validateKey(key)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('401') || message.includes('403')) {
      isAuthError = true
      isValid = false
    } else {
      // Network error
      return {
        authState: createInvalidAuthState(true),
        reason: 'network-error',
      }
    }
  }

  if (!isValid || isAuthError) {
    if (apiKey) {
      // Clean up invalid key
      await keychainService.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
    }
    return {
      authState: createInvalidAuthState(apiKey ? false : true),
      reason: apiKey ? 'api-401' : 'startup',
    }
  }

  return {
    authState: createValidAuthState('api-key'),
    reason: apiKey ? 'key-submitted' : 'startup',
  }
}
