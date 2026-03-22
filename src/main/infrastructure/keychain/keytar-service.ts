import keytar from 'keytar'
import log from 'electron-log'

/**
 * Thin wrapper around keytar for OS keychain access.
 * API keys and MCP auth keys are stored exclusively here — never on disk.
 */
export interface IKeychainService {
  getPassword(service: string, account: string): Promise<string | null>
  setPassword(service: string, account: string, password: string): Promise<void>
  deletePassword(service: string, account: string): Promise<void>
}

export class KeytarService implements IKeychainService {
  async getPassword(service: string, account: string): Promise<string | null> {
    try {
      return await keytar.getPassword(service, account)
    } catch (err) {
      log.error({ component: 'keytar-service', op: 'getPassword', service, err })
      return null
    }
  }

  async setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void> {
    await keytar.setPassword(service, account, password)
  }

  async deletePassword(service: string, account: string): Promise<void> {
    await keytar.deletePassword(service, account)
  }
}
