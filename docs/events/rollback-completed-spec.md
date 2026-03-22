# Event Specification — rollback:completed

**Status:** Draft  **Date:** 2026-03-21  **Transport:** Electron IPC push (main → renderer)

## Purpose
Notifies the renderer that a file rollback completed successfully. Delivers the restored content so the editor reloads without a separate `file:read` round-trip.

## Producer
`backup-service` (via main) — emitted after `RollbackUseCase` writes the restored content to disk.

## Consumers
| Consumer | Reaction |
|---|---|
| EditorStore | Replace editor content with `restoredContent`; clear `isDirty` |
| BackupHistoryView | Refresh snapshot list (pre-rollback snapshot now at top) |
| StatusBar | Show "Rolled back to [timestamp]" toast |

## Payload Schema
```typescript
interface RollbackCompletedPayload {
  filePath: string;
  restoredContent: string;
  restoredFromSnapshot: { snapshotPath: string; timestamp: string; };
  preRollbackSnapshot: { snapshotPath: string; timestamp: string; };
  correlationId: string;
}
```

## Rules
- `restoredContent` delivered inline — no `file:read` round-trip needed
- `preRollbackSnapshot` always present — confirms the rollback itself is reversible
- A `config:changed` event follows this event (WriteFileUseCase) — renderer must not double-apply content
- `restoredContent` must not be logged (may contain user configuration data)
- `preRollbackSnapshot` appears in `BackupHistoryView` on next `backup:list`, allowing undo of rollback
