import {
  isExpired,
  createValidAuthState,
  createInvalidAuthState,
} from '../../../src/main/domain/models/auth-state'

describe('AuthState', () => {
  describe('isExpired', () => {
    it('returns true when lastValidatedAt is null', () => {
      const state = createInvalidAuthState(false)
      expect(isExpired(state)).toBe(true)
    })

    it('returns false when validated recently', () => {
      const state = createValidAuthState('api-key')
      expect(isExpired(state)).toBe(false)
    })

    it('returns true when validated more than 1h ago', () => {
      const state = {
        isValid: true,
        keyPresent: true,
        lastValidatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        authMethod: 'api-key' as const,
      }
      expect(isExpired(state)).toBe(true)
    })
  })

  describe('createValidAuthState', () => {
    it('creates a valid state', () => {
      const state = createValidAuthState('api-key')
      expect(state.isValid).toBe(true)
      expect(state.keyPresent).toBe(true)
      expect(state.lastValidatedAt).toBeInstanceOf(Date)
      expect(state.authMethod).toBe('api-key')
    })
  })

  describe('createInvalidAuthState', () => {
    it('creates invalid state with keyPresent flag', () => {
      expect(createInvalidAuthState(true).keyPresent).toBe(true)
      expect(createInvalidAuthState(false).keyPresent).toBe(false)
      expect(createInvalidAuthState(false).isValid).toBe(false)
    })
  })
})
