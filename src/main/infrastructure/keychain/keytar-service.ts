import log from 'electron-log'

/**
 * Thin wrapper around keytar for OS keychain access.
 * API keys and MCP auth keys are stored exclusively here — never on disk.
 *
 * keytar is loaded lazily so that a missing libsecret (CI/headless Linux)
 * does not crash the process at import time.  When keytar is unavailable the
 * service falls back to an in-memory store so that integration tests can run
 * without a D-Bus / keyring daemon.
 */
export interface IKeychainService {
  getPassword(service: string, account: string): Promise<string | null>
  setPassword(service: string, account: string, password: string): Promise<void>
  deletePassword(service: string, account: string): Promise<void>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _keytar: any | null = undefined

function getKeytar() {
  if (_keytar === undefined) {
    try {
      // Dynamic require keeps the native .node out of the module-load critical path
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _keytar = require('keytar')
    } catch (err) {
      log.warn({ component: 'keytar-service', msg: 'keytar unavailable, falling back to in-memory store', err })
      _keytar = null
    }
  }
  return _keytar
}

export class KeytarService implements IKeychainService {
  private readonly _fallback = new Map<string, string>()

  async getPassword(service: string, account: string): Promise<string | null> {
    const kt = getKeytar()
    if (!kt) return this._fallback.get(`${service}:${account}`) ?? null
    try {
      return await kt.getPassword(service, account)
    } catch (err) {
      log.error({ component: 'keytar-service', op: 'getPassword', service, err })
      return null
    }
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    const kt = getKeytar()
    if (!kt) { this._fallback.set(`${service}:${account}`, password); return }
    await kt.setPassword(service, account, password)
  }

  async deletePassword(service: string, account: string): Promise<void> {
    const kt = getKeytar()
    if (!kt) { this._fallback.delete(`${service}:${account}`); return }
    await kt.deletePassword(service, account)
  }
}
