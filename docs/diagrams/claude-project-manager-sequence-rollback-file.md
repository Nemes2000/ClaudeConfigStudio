# Sequence Diagram — Rollback File

**Status:** Draft
**Date:** 2026-03-21
**Use case:** User opens backup history for a file, selects a snapshot, and restores it — the rollback is itself snapshotted so it is undoable
**Depends on:** `docs/diagrams/claude-project-manager-class.md`

---

## Specs Read

| Spec | File | Used for |
|---|---|---|
| Class diagram | `docs/diagrams/claude-project-manager-class.md` | Snapshot, BackupPolicy |
| Service spec (backup-service) | `docs/architecture/service-backup-service.md` | ListSnapshotsUseCase, RollbackUseCase |
| Service spec (renderer-process) | `docs/architecture/service-renderer-process.md` | BackupHistoryView, editor reload |

---

## Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Renderer as Renderer Process<br/>(BackupHistoryView)
    participant Main as Main Process
    participant Backup as backup-service
    participant GraphSvc as skill-graph-service
    participant FS as Filesystem

    %% ── Step 1: Open history panel ──
    User->>Renderer: Clicks "History" on open file
    Renderer->>Main: IPC backup:list (filePath)
    Main->>Backup: ListSnapshotsUseCase(filePath)
    activate Backup
    Backup->>FS: Read .backups/<relative-path>/ directory
    FS-->>Backup: snapshot filenames (ISO timestamps)

    loop For each snapshot (up to 50)
        Backup->>FS: Read first non-empty line (preview)
        FS-->>Backup: previewLine
    end

    Backup-->>Main: Snapshot[] (sorted newest first)
    deactivate Backup
    Main-->>Renderer: IPC backup:list response (Snapshot[])
    Renderer-->>User: Shows snapshot list with timestamps, sizes, preview lines

    %% ── Step 2: User selects snapshot to restore ──
    User->>Renderer: Clicks "Restore" on selected Snapshot
    Renderer->>Renderer: Show confirmation dialog (destructive action)
    User->>Renderer: Confirms restore

    Renderer->>Main: IPC backup:rollback (selectedSnapshot)
    activate Main

    %% ── Step 3: Pre-rollback snapshot (rollback is reversible) ──
    Main->>Backup: SnapshotFileUseCase(originalFilePath)
    activate Backup
    Backup->>FS: Read current file content
    FS-->>Backup: currentContent
    Backup->>FS: Write pre-rollback snapshot to .backups/<path>/<now>.md
    FS-->>Backup: ok
    Backup->>Backup: PruneSnapshotsUseCase
    Backup-->>Main: preRollbackSnapshot
    deactivate Backup

    Main-->>Renderer: IPC backup:created (preRollbackSnapshot)
    note over Renderer: Pre-rollback snapshot appears at top of history list

    %% ── Step 4: Restore selected snapshot ──
    Main->>FS: Read selectedSnapshot.snapshotPath
    FS-->>Main: restoredContent

    Main->>FS: fs.writeFile(originalFilePath, restoredContent)
    FS-->>Main: ok

    %% ── Step 5: Rebuild graph and reload editor ──
    Main->>FS: Read all SKILL.md files for project
    FS-->>Main: FileEntry[]
    Main->>GraphSvc: buildGraph(fileEntries)
    GraphSvc-->>Main: DependencyGraph + CytoscapeElements
    Main-->>Renderer: IPC graph:updated (CytoscapeElements)

    Main-->>Renderer: IPC rollback:completed (filePath, restoredContent)
    deactivate Main

    Renderer->>Renderer: EditorStore.setContent(restoredContent) — editor reloads
    Renderer->>Renderer: GraphStore.setElements() — graph re-renders
    Renderer-->>User: Editor shows restored content; graph updated; success toast shown
```

---

## Alt Flows

```mermaid
sequenceDiagram
    autonumber
    participant Main as Main Process
    participant Backup as backup-service

    note over Main,Backup: Alt: Pre-rollback snapshot fails — abort rollback
    Main->>Backup: SnapshotFileUseCase(originalFilePath)
    Backup-->>Main: Error (disk full / permission denied)
    Main-->>Main: Abort rollback — surface error to renderer
    note over Main: Original file unchanged; renderer shows error toast

    note over Main,Backup: Alt: No snapshots exist for file
    Main->>Backup: ListSnapshotsUseCase(filePath)
    Backup->>Backup: Snapshot directory does not exist
    Backup-->>Main: [] (empty list)
    note over Main: Renderer shows "No history available for this file"
```

---

## Notes

- The pre-rollback snapshot is created before every restore — the user can always undo a rollback by restoring from it
- `.backups/` directory is excluded from Git tracking (backup-service adds it to `.claude/.gitignore` on first snapshot)
- Snapshot list is capped at 50 per `BackupPolicy.maxSnapshotsPerFile`; oldest are pruned automatically
- Rollback triggers a full graph rebuild because the restored file may have different `dependencies` in frontmatter
