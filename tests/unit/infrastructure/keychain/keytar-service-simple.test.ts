jest.mock('keytar', () => ({
  default: {
    getPassword: jest.fn(),
    setPassword: jest.fn(),
    deletePassword: jest.fn(),
  },
}))
jest.mock('electron-log', () => ({ default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }))

import { KeytarService } from '../../../../src/main/infrastructure/keychain/keytar-service'

describe('KeytarService', () => {
  it('should be instantiable', () => {
    const service = new KeytarService()
    expect(service).toBeDefined()
  })

  it('should implement IKeychainService interface', () => {
    const service = new KeytarService()
    expect(typeof service.getPassword).toBe('function')
    expect(typeof service.setPassword).toBe('function')
    expect(typeof service.deletePassword).toBe('function')
  })
})
