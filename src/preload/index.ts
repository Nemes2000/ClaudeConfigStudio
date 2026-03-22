import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type IpcChannel } from '../shared/ipc-channels'

/**
 * Preload script — exposes a typed IPC bridge to the renderer.
 * No business logic here. No Node.js APIs exposed beyond IPC.
 * contextIsolation=true ensures renderer cannot access Node.js directly.
 */

const api = {
  /**
   * Invoke a channel (request/response pattern).
   * Only whitelisted channels are permitted.
   */
  invoke<T = unknown>(channel: IpcChannel, payload?: unknown): Promise<T> {
    if (!INVOKE_WHITELIST.has(channel)) {
      return Promise.reject(new Error(`Channel "${channel}" is not allowed`))
    }
    return ipcRenderer.invoke(channel, payload)
  },

  /**
   * Subscribe to a push event from the main process.
   * Returns an unsubscribe function.
   */
  on(channel: IpcChannel, listener: (payload: unknown) => void): () => void {
    if (!PUSH_WHITELIST.has(channel)) {
      throw new Error(`Push channel "${channel}" is not allowed`)
    }
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void =>
      listener(payload)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.off(channel, handler)
  },
}

const INVOKE_WHITELIST = new Set<IpcChannel>([
  IPC_CHANNELS.PROJECT_SCAN,
  IPC_CHANNELS.PROJECT_LIST,
  IPC_CHANNELS.PROJECT_CREATE,
  IPC_CHANNELS.FILE_READ,
  IPC_CHANNELS.FILE_WRITE,
  IPC_CHANNELS.FILE_DELETE,
  IPC_CHANNELS.FILE_UPDATE_SECTION,
  IPC_CHANNELS.FILE_DELETE_SECTION,
  IPC_CHANNELS.FILE_ADD_SECTION,
  IPC_CHANNELS.FILE_ADD_ITEM,
  IPC_CHANNELS.FILE_UPDATE_ITEM,
  IPC_CHANNELS.FILE_DELETE_ITEM,
  IPC_CHANNELS.FILE_REORDER_ITEM,
  IPC_CHANNELS.SKILL_TOGGLE,
  IPC_CHANNELS.SKILL_CREATE,
  IPC_CHANNELS.SKILL_DELETE,
  IPC_CHANNELS.SKILL_VALIDATE_STRUCTURE,
  IPC_CHANNELS.RULE_TOGGLE,
  IPC_CHANNELS.RULE_CREATE,
  IPC_CHANNELS.RULE_DELETE,
  IPC_CHANNELS.RULE_LIST_GLOBAL,
  IPC_CHANNELS.RULE_GET_HIERARCHY,
  IPC_CHANNELS.RULE_CREATE_SUPPLEMENT,
  IPC_CHANNELS.HOOK_TOGGLE,
  IPC_CHANNELS.BACKUP_LIST,
  IPC_CHANNELS.BACKUP_ROLLBACK,
  IPC_CHANNELS.AUTH_VALIDATE,
  IPC_CHANNELS.AUTH_SIGN_IN_WITH_CLAUDE,
  IPC_CHANNELS.AUTH_SIGN_OUT,
  IPC_CHANNELS.SUGGESTION_REQUEST,
  IPC_CHANNELS.MCP_LIST_MARKETPLACE,
  IPC_CHANNELS.MCP_VALIDATE_COMPATIBILITY,
  IPC_CHANNELS.MCP_INSTALL,
  IPC_CHANNELS.MCP_UNINSTALL,
  IPC_CHANNELS.MCP_TOGGLE,
  IPC_CHANNELS.MCP_SET_AUTH_KEY,
  IPC_CHANNELS.MCP_LIST_INSTALLED,
])

const PUSH_WHITELIST = new Set<IpcChannel>([
  IPC_CHANNELS.PROJECT_DISCOVERED,
  IPC_CHANNELS.CONFIG_CHANGED,
  IPC_CHANNELS.GRAPH_UPDATED,
  IPC_CHANNELS.BACKUP_CREATED,
  IPC_CHANNELS.ORCHESTRATOR_SYNC_STARTED,
  IPC_CHANNELS.ORCHESTRATOR_SYNC_CHUNK,
  IPC_CHANNELS.ORCHESTRATOR_SYNC_COMPLETED,
  IPC_CHANNELS.AUTH_STATE_CHANGED,
  IPC_CHANNELS.SUGGESTION_READY,
  IPC_CHANNELS.ROLLBACK_COMPLETED,
  IPC_CHANNELS.RULE_HIERARCHY_UPDATED,
])

contextBridge.exposeInMainWorld('electronApi', api)

export type ElectronApi = typeof api
