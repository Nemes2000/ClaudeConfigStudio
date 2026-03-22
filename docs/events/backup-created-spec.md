# Event Specification — backup:created

**Status:** Draft  **Date:** 2026-03-21  **Transport:** Electron IPC push (main → renderer)

## Purpose
Notifies the renderer that a backup snapshot was successfully created before a file write. Enables `BackupHistoryView` to refresh its snapshot list without a separate `backup:list` round-trip.

## Producer
`backup-service` (via main) — emitted by `SnapshotFileUseCase` immediately after the snapshot file is written to `.claude/.backups/`.

## Consumers
| Consumer | Reaction |
|---|---|
| BackupHistoryView | Prepend new snapshot to top of history list |
| StatusBar | Show transient "Backup saved" confirmation (auto-dismiss after 2s) |

## Payload Schema
```typescript
interface BackupCreatedPayload {
  snapshot: {
    originalFilePath: string;   // absolute path of the source file that was snapshotted
    snapshotPath: string;       // absolute path of the new snapshot file
    timestamp: string;          // ISO 8601 (e.g. "2026-03-21T14:32:10.123Z")
    sizeBytes: number;
    previewLine: string;        // first non-empty line of snapshotted content
  };
  correlationId: string;        // matches the triggering file:write or backup:rollback request
}
```

## Rules
- `backup:created` fires **before** `config:changed` — the snapshot is guaranteed to exist before the new file content is written
- `snapshotPath` must never be logged in full (may expose user configuration content via path)
- `previewLine` is truncated to 120 characters; must not contain API key patterns (stripped by backup-service)
- `correlationId` matches the `file:write` IPC invoke that triggered this snapshot, enabling the renderer to correlate backup and write confirmations
- Event is not emitted for new file creation (no pre-existing content to snapshot)
- `BackupHistoryView` must handle receiving this event while the panel is not open (store the update; apply on next panel open)
