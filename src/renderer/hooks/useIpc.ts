import { useEffect } from 'react'
import type { IpcChannel } from '../../shared/ipc-channels'

declare global {
  interface Window {
    electronApi: {
      invoke<T = unknown>(channel: IpcChannel, payload?: unknown): Promise<T>
      on(channel: IpcChannel, listener: (payload: unknown) => void): () => void
    }
  }
}

export function useIpc() {
  return window.electronApi
}

/**
 * Subscribes to a push channel and calls listener on each event.
 * Automatically unsubscribes on component unmount.
 */
export function useIpcListener(
  channel: IpcChannel,
  listener: (payload: unknown) => void,
  deps: unknown[] = [],
): void {
  useEffect(() => {
    const unsubscribe = window.electronApi.on(channel, listener)
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, ...deps])
}
