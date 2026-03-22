import React, { useState, useCallback } from 'react'
import { useIpc } from '../hooks/useIpc'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { IpcSnapshot } from '../../shared/ipc-channels'

interface Props {
  filePath: string
  onClose: () => void
}

export function BackupHistoryView({ filePath, onClose }: Props): React.ReactElement {
  const [snapshots, setSnapshots] = useState<IpcSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ipc = useIpc()

  const loadSnapshots = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await ipc.invoke<IpcSnapshot[]>(IPC_CHANNELS.BACKUP_LIST, { filePath })
      setSnapshots(result ?? [])
    } catch {
      setError('Could not load backup history')
    } finally {
      setIsLoading(false)
    }
  }, [filePath, ipc])

  React.useEffect(() => {
    void loadSnapshots()
  }, [loadSnapshots])

  async function handleRestore(snapshot: IpcSnapshot): Promise<void> {
    if (!confirm('Restore this snapshot? The current file will be backed up first.')) return
    setIsLoading(true)
    try {
      await ipc.invoke(IPC_CHANNELS.BACKUP_ROLLBACK, { snapshot })
      onClose()
    } catch {
      setError('Restore failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div data-testid="backup-history-view" style={{ padding: 20 }}>
      <h3>Backup History</h3>
      <button onClick={onClose}>Close</button>
      {isLoading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {snapshots.length === 0 && !isLoading && (
        <p data-testid="no-history">No history available for this file.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {snapshots.map((s, idx) => (
          <li key={idx} data-testid={`snapshot-${idx}`} style={{ marginBottom: 8 }}>
            <span>{new Date(s.timestamp).toLocaleString()}</span>
            <span style={{ marginLeft: 8, fontSize: 11, color: '#666' }}>
              {Math.round(s.sizeBytes / 1024)}KB
            </span>
            <span style={{ marginLeft: 8, fontStyle: 'italic', fontSize: 11 }}>
              {s.previewLine.slice(0, 60)}
            </span>
            <button
              data-testid={`restore-button-${idx}`}
              onClick={() => handleRestore(s)}
              disabled={isLoading}
              style={{ marginLeft: 8 }}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
