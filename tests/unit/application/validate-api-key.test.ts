import { validateApiKey } from '../../../src/main/application/commands/validate-api-key-use-case'
import type { IKeychainService, IAnthropicClient } from '../../../src/main/application/commands/validate-api-key-use-case'

function makeKeychain(key: string | null = null): jest.Mocked<IKeychainService> {
  return {
    getPassword: jest.fn().mockResolvedValue(key),
    setPassword: jest.fn().mockResolvedValue(undefined),
    deletePassword: jest.fn().mockResolvedValue(undefined),
  }
}

function makeClient(valid: boolean): jest.Mocked<IAnthropicClient> {
  return {
    validateKey: jest.fn().mockResolvedValue(valid),
  }
}

describe('validateApiKey', () => {
  it('returns keyMissing state when no key in keychain', async () => {
    const result = await validateApiKey({
      keychainService: makeKeychain(null),
      anthropicClient: makeClient(true),
    })
    expect(result.authState.isValid).toBe(false)
    expect(result.authState.keyPresent).toBe(false)
  })

  it('returns valid state when key validates successfully', async () => {
    const result = await validateApiKey({
      keychainService: makeKeychain('sk-ant-test'),
      anthropicClient: makeClient(true),
    })
    expect(result.authState.isValid).toBe(true)
    expect(result.authState.keyPresent).toBe(true)
  })

  it('stores key before validating on explicit submission', async () => {
    const keychain = makeKeychain(null)
    const client = makeClient(true)
    await validateApiKey({
      keychainService: keychain,
      anthropicClient: client,
      apiKey: 'sk-ant-new',
    })
    expect(keychain.setPassword).toHaveBeenCalledWith(
      'claude-project-manager',
      'api-key',
      'sk-ant-new',
    )
  })

  it('deletes key on 401 and returns invalid state', async () => {
    const keychain = makeKeychain(null)
    const client: jest.Mocked<IAnthropicClient> = {
      validateKey: jest.fn().mockRejectedValue(new Error('401 Unauthorized')),
    }
    const result = await validateApiKey({
      keychainService: keychain,
      anthropicClient: client,
      apiKey: 'sk-ant-invalid',
    })
    expect(keychain.deletePassword).toHaveBeenCalled()
    expect(result.authState.isValid).toBe(false)
    expect(result.reason).toBe('api-401')
  })

  it('returns network-error state on connection failure', async () => {
    const client: jest.Mocked<IAnthropicClient> = {
      validateKey: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    }
    const result = await validateApiKey({
      keychainService: makeKeychain('sk-ant-stored'),
      anthropicClient: client,
    })
    expect(result.authState.isValid).toBe(false)
    expect(result.authState.keyPresent).toBe(true)
    expect(result.reason).toBe('network-error')
  })
})
