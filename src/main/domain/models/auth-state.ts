/** Session auth state. The raw API key is never stored here — only flags. */
export interface AuthState {
  readonly isValid: boolean
  readonly keyPresent: boolean
  readonly lastValidatedAt: Date | null
}

/** An auth state is considered expired if it was last validated more than 1h ago. */
export function isExpired(state: AuthState): boolean {
  if (!state.lastValidatedAt) return true
  return Date.now() - state.lastValidatedAt.getTime() > 60 * 60 * 1000
}

export function createInvalidAuthState(keyPresent: boolean): AuthState {
  return { isValid: false, keyPresent, lastValidatedAt: null }
}

export function createValidAuthState(): AuthState {
  return { isValid: true, keyPresent: true, lastValidatedAt: new Date() }
}
