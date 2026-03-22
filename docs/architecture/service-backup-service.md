# Service Specification — backup-service

**Status:** Draft
**Date:** 2026-03-21
**Owner:** TBD
**System:** Claude Project Manager (CPM)
**Stack:** Node.js 20 LTS · TypeScript 5 · fs.promises · in-process module

---

## 1. Bounded Context

**Responsibility:** Owns the backup and restore lifecycle for all `.claude/` folder files. Before every file write, creates a timestamped snapshot of the current file content. Provides a queryable snapshot history per file and executes rollback by replacing the current file with a selected snapshot. All data is stored in the local filesystem — no database, no external service.

**Does not own:**
- The decision to write a file (main-process WriteFileUseCase calls backup-service before writing)
- UI for displaying backup history (renderer-process BackupHistoryView)
- Git commit history (git-service)

---

## 2. Responsibilities

- Create timestamped snapshot of a file before any write operation
- Store snapshots at: `.claude/.backups/<relative-file-path>/<ISO-8601-timestamp>.md`
- List all snapshots for a given file path, sorted newest first
- Execute rollback: snapshot current file, then replace it with the selected snapshot
- Prune old snapshots: retain the last N snapshots per file (configurable, default 50)
- Report snapshot metadata: timestamp, file size, first changed line preview

---

## 3. Hexagonal Layer Boundaries

```
backup-service (in-process module)
├── domain/
│   ├── Snapshot            — value object: filePath, snapshotPath, timestamp, sizeBytes, previewLine
│   └── BackupPolicy        — value object: maxSnapshotsPerFile (default 50)
├── application/
│   ├── SnapshotFileUseCase  — create snapshot before write
│   ├── ListSnapshotsUseCase — return sorted snapshot list for a file
│   ├── RollbackUseCase      — restore a file from a selected snapshot
│   └── PruneSnapshotsUseCase — enforce maxSnapshotsPerFile after each snapshot
└── infrastructure/
    └── SnapshotStore        — fs.promises wrappers for snapshot directory operations
```

---

## 4. Domain Models

```typescript
interface Snapshot {
  originalFilePath: string;   // absolute path of the source file
  snapshotPath: string;       // absolute path of the snapshot file
  timestamp: Date;            // parsed from filename
  sizeBytes: number;
  previewLine: string;        // first non-empty line of content (for display)
}

interface BackupPolicy {
  maxSnapshotsPerFile: number; // default: 50
}
```

---

## 5. Snapshot Storage Layout

```
.claude/
└── .backups/
    ├── skills/
    │   └── spec-service/
    │       └── SKILL.md/
    │           ├── 2026-03-21T14-32-10-123Z.md
    │           ├── 2026-03-21T15-01-44-007Z.md
    │           └── ...
    └── rules/
        └── coding/
            └── RULE.md/
                └── 2026-03-20T09-12-00-000Z.md
```

- Snapshot filename: ISO 8601 with time colons and millisecond decimal point replaced by hyphens (filesystem-safe) — format: `YYYY-MM-DDTHH-mm-ss-SSSZ` (e.g. `2026-03-21T14-32-10-123Z.md`)
- Relative path mirrors the original file's path within `.claude/` — following the `skills/<name>/SKILL.md` convention
- `.backups/` directory is excluded from Git tracking via `.gitignore` entry added on creation

---

## 6. Key Use Cases

### SnapshotFileUseCase
- Input: absolute path of file about to be written
- Action:
  1. Read current file content (if file exists — skip if new file)
  2. Compute snapshot path from relative file path + current timestamp
  3. Create snapshot directory if needed (`fs.promises.mkdir` with `recursive: true`)
  4. Write snapshot file
  5. Call `PruneSnapshotsUseCase`
- Output: `Snapshot` (the newly created snapshot)
- Must complete before the caller proceeds with the file write
- If file does not exist yet (new file creation): no snapshot needed; return null

### ListSnapshotsUseCase
- Input: absolute path of file
- Action: read snapshot directory for this file; parse timestamps from filenames; read first line of each for preview
- Output: `Snapshot[]` sorted by timestamp descending (newest first)
- Max returned: 50 (matches `BackupPolicy.maxSnapshotsPerFile`)

### RollbackUseCase
- Input: `Snapshot` to restore to
- Action:
  1. Call `SnapshotFileUseCase` on the current file (snapshot the current state before rollback — rollback is itself reversible)
  2. Read selected snapshot content
  3. Write snapshot content to the original file path via `fs.promises.writeFile`
  4. Emit `rollback:completed` IPC event with the restored file path
- Output: restored file content string (for renderer to reload editor)
- The pre-rollback snapshot appears in the history list — user can undo the rollback

### PruneSnapshotsUseCase
- Input: snapshot directory path + `BackupPolicy`
- Action: list all snapshots; if count > `maxSnapshotsPerFile`, delete oldest (by timestamp) until at limit
- Runs synchronously after every `SnapshotFileUseCase` call

---

## 7. IPC Channels Served

| Channel | Caller | Response |
|---|---|---|
| `backup:list` | renderer | `Snapshot[]` for a given file path |
| `backup:rollback` | renderer | restored content string + `rollback:completed` event |
| `backup:created` | this → renderer | push notification after snapshot created |
| `rollback:completed` | this → renderer | push notification after rollback write |

---

## 8. .gitignore Management

On first backup creation for a `.claude/` folder that is Git-tracked:
- Check if `.claude/.gitignore` exists
- If `.backups/` is not already ignored, append `.backups/` to `.claude/.gitignore`
- This prevents backup snapshots from polluting Git history

---

## 9. Dependencies

| Dependency | Type | Purpose |
|---|---|---|
| fs.promises | Node.js stdlib | All snapshot file I/O |
| path | Node.js stdlib | Snapshot path construction |
| main-process | internal | Called by WriteFileUseCase before every write |

No npm dependencies beyond Node.js stdlib.

---

## 10. Observability

- Log every snapshot creation at INFO: `{ component: "backup-service", originalPath, snapshotPath, sizeBytes }`
- Log every rollback at INFO: `{ component: "backup-service", restoredFrom: snapshotPath, targetPath }`
- Log prune actions at DEBUG: `{ prunedCount, remainingCount, directory }`

---

## 11. Error Handling

- Snapshot write failure: log ERROR; **abort the parent file write** — never write without a successful snapshot (safety-first)
- Rollback pre-snapshot failure: log ERROR; abort rollback; surface error to renderer
- Snapshot directory missing on `ListSnapshotsUseCase`: return empty array (not an error — file may never have been edited)
- Prune failure: log WARN; do not block snapshot creation — prune is best-effort
