# Sequence Diagram — Edit Skill and Orchestrator Sync

**Status:** Draft
**Date:** 2026-03-21
**Use case:** User edits a skill file → backup snapshot created → graph re-parsed → affected orchestrator skills identified → Claude API rewrites each orchestrator → orchestrator files saved
**Depends on:** `docs/diagrams/claude-project-manager-class.md`

---

## Specs Read

| Spec | File | Used for |
|---|---|---|
| Class diagram | `docs/diagrams/claude-project-manager-class.md` | Entity names, method signatures |
| Service spec (main-process) | `docs/architecture/service-main-process.md` | WriteFileUseCase, ToggleSkillUseCase |
| Service spec (skill-graph-service) | `docs/architecture/service-skill-graph-service.md` | FindOrchestratorsUseCase |
| Service spec (ai-suggestion-service) | `docs/architecture/service-ai-suggestion-service.md` | SyncOrchestratorUseCase, streaming |
| Service spec (backup-service) | `docs/architecture/service-backup-service.md` | SnapshotFileUseCase |

---

## Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Renderer as Renderer Process<br/>(React UI)
    participant Main as Main Process
    participant Backup as backup-service
    participant GraphSvc as skill-graph-service
    participant AISvc as ai-suggestion-service
    participant Claude as Claude API<br/>(Anthropic)
    participant FS as Filesystem

    User->>Renderer: Edits skill in Monaco editor, presses Ctrl+S

    Renderer->>Main: IPC file:write (filePath, newContent)
    activate Main

    %% ── Step 1: Backup ──
    Main->>Backup: SnapshotFileUseCase(filePath)
    activate Backup
    Backup->>FS: Read current file content
    FS-->>Backup: oldContent
    Backup->>FS: Write snapshot to .backups/<path>/<timestamp>.md
    FS-->>Backup: ok
    Backup->>Backup: PruneSnapshotsUseCase (enforce max 50)
    Backup-->>Main: Snapshot (snapshotPath, timestamp)
    deactivate Backup

    Main-->>Renderer: IPC backup:created (snapshot metadata)

    %% ── Step 2: Write file ──
    Main->>FS: fs.writeFile(filePath, newContent)
    FS-->>Main: ok
    Main-->>Renderer: IPC config:changed (filePath)

    %% ── Step 3: Rebuild graph ──
    Main->>FS: Read all SKILL.md files for project
    FS-->>Main: FileEntry[]
    Main->>GraphSvc: buildGraph(fileEntries)
    activate GraphSvc
    GraphSvc->>GraphSvc: BuildGraphUseCase + ValidateGraphUseCase
    GraphSvc-->>Main: DependencyGraph
    Main->>GraphSvc: serializeForCytoscape(graph)
    GraphSvc-->>Main: CytoscapeElements
    deactivate GraphSvc

    Main-->>Renderer: IPC graph:updated (CytoscapeElements)
    Renderer->>Renderer: GraphStore.setElements() — graph re-renders

    %% ── Step 4: Find orchestrators ──
    Main->>GraphSvc: findOrchestrators(modifiedSlug, graph)
    activate GraphSvc
    GraphSvc->>GraphSvc: FindOrchestratorsUseCase — traverse reverseEdges
    GraphSvc-->>Main: SkillNode[] (affected orchestrators)
    deactivate GraphSvc

    alt No orchestrators reference this skill
        Main-->>Renderer: (no sync needed)
        note over Main,Renderer: Flow ends here for leaf skills
    else Orchestrators found
        Main-->>Renderer: IPC orchestrator:sync-started (orchestratorPaths[])
        Renderer->>Renderer: DiffViewer opens for first orchestrator

        %% ── Step 5: Read orchestrator files ──
        loop For each orchestrator SkillNode
            Main->>FS: Read orchestrator SKILL.md
            FS-->>Main: orchestratorContent
        end

        %% ── Step 6: Sync via Claude API (sequential per orchestrator) ──
        Main->>AISvc: SyncOrchestratorUseCase(modifiedSkill, orchestrators[])
        activate AISvc

        loop For each orchestrator (sequential)
            AISvc->>AISvc: Build sync prompt (modified skill + orchestrator content)
            AISvc->>Claude: anthropic.messages.stream() — claude-sonnet-4-6, max 32K ctx, timeout 120s
            activate Claude

            loop Stream chunks
                Claude-->>AISvc: MessageStreamEvent (chunk)
                AISvc-->>Renderer: IPC orchestrator:sync-chunk (orchestratorPath, chunkText)
                Renderer->>Renderer: DiffViewer appends chunk to newContent pane
            end

            Claude-->>AISvc: Stream complete
            deactivate Claude

            AISvc->>AISvc: Assemble OrchestratorUpdate (oldContent, newContent, isPartial=false)

            %% ── Step 7: Save updated orchestrator ──
            AISvc-->>Main: OrchestratorUpdate
            Main->>Backup: SnapshotFileUseCase(orchestratorPath)
            Backup->>FS: Snapshot current orchestrator file
            FS-->>Backup: ok
            Backup-->>Main: Snapshot
            Main->>FS: fs.writeFile(orchestratorPath, newContent)
            FS-->>Main: ok
            Main-->>Renderer: IPC config:changed (orchestratorPath)
        end

        deactivate AISvc
        Main-->>Renderer: IPC orchestrator:sync-completed (updatedPaths[])
        Renderer->>Renderer: DiffViewer shows final diff; user can review
        deactivate Main
    end
```

---

## Alt Flows

```mermaid
sequenceDiagram
    autonumber
    participant Main as Main Process
    participant Backup as backup-service
    participant AISvc as ai-suggestion-service

    note over Main,Backup: Alt: Backup fails — abort write
    Main->>Backup: SnapshotFileUseCase(filePath)
    Backup-->>Main: Error (disk full / permission denied)
    Main-->>Main: Abort file:write — surface error to renderer
    note over Main: File NOT written; renderer shows error toast

    note over AISvc: Alt: Claude API stream interrupted mid-sync
    AISvc->>AISvc: Stream error / timeout after 120s
    AISvc->>AISvc: OrchestratorUpdate.isPartial = true
    AISvc-->>Main: OrchestratorUpdate (isPartial=true)
    note over Main: Renderer shows partial diff with warning; user can retry or discard

    note over AISvc: Alt: Circuit breaker OPEN
    AISvc->>AISvc: circuitBreaker.state === OPEN
    AISvc-->>Main: Error (circuit open)
    Main-->>Main: Renderer shows "Claude API unavailable" banner
    note over Main: Orchestrator sync skipped; file write and graph refresh still complete
```

---

## Notes

- Backup must succeed before file write — if backup fails the write is aborted (safety-first per backup-service spec)
- Orchestrators are synced sequentially, not in parallel, to avoid Claude API rate limit spikes and allow mid-sync cancellation
- Timeout: 120s per orchestrator sync call (large context); 30s for non-streaming calls
- Circuit breaker opens after 5 consecutive Claude API failures; orchestrator sync is skipped but file write completes normally
- The pre-orchestrator-write backup ensures the orchestrator can itself be rolled back if the Claude API output is wrong
