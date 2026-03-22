# State Diagram — OrchestratorUpdate

**Status:** Draft
**Date:** 2026-03-21
**Entity:** OrchestratorUpdate (ai-suggestion-service domain)
**Depends on:** `docs/diagrams/claude-project-manager-class.md`

---

## Specs Read

| Spec | File | Used for |
|---|---|---|
| Class diagram | `docs/diagrams/claude-project-manager-class.md` | OrchestratorUpdate.isPartial |
| Service spec (ai-suggestion-service) | `docs/architecture/service-ai-suggestion-service.md` | SyncOrchestratorUseCase, streaming |
| Sequence diagram | `docs/diagrams/claude-project-manager-sequence-edit-skill-and-sync.md` | Full sync flow |

---

## Diagram

```mermaid
stateDiagram-v2
    [*] --> Pending : SyncOrchestratorUseCase started\nOrchestrator identified by FindOrchestratorsUseCase\n/ orchestrator:sync-started IPC emitted\n/ DiffViewer opens in renderer

    Pending --> Streaming : anthropic.messages.stream() call initiated\nCircuit breaker CLOSED\nRate limiter token acquired\n/ First chunk received from Claude API

    Pending --> Cancelled : User clicks Cancel during sync\nor Circuit breaker OPEN at call time\n/ orchestrator:sync-chunk not emitted\n/ DiffViewer dismissed

    Streaming --> Streaming : Claude API stream chunk received\n/ orchestrator:sync-chunk IPC emitted\n/ DiffViewer appends chunk to newContent pane

    Streaming --> Complete : Stream finished (stop_reason: end_turn)\nisPartial = false\n/ OrchestratorUpdate(oldContent, newContent, isPartial=false)\n/ WriteFileUseCase called with newContent\n/ Backup snapshot taken before write

    Streaming --> Partial : Stream interrupted (timeout after 120s,\nnetwork error, or user cancel mid-stream)\nisPartial = true\n/ OrchestratorUpdate(oldContent, partialContent, isPartial=true)\n/ orchestrator:sync-completed with isPartial=true

    Complete --> [*] : File written successfully\n/ config:changed emitted\n/ graph re-renders\n/ DiffViewer shows final accepted diff

    Partial --> [*] : User clicks "Discard partial"\n/ newContent discarded\n/ file NOT written\n/ DiffViewer dismissed

    Partial --> Pending : User clicks "Retry"\n/ SyncOrchestratorUseCase re-invoked for same orchestrator\n/ DiffViewer resets

    Cancelled --> [*] : Clean exit\n/ No file write\n/ DiffViewer dismissed
```

---

## State Descriptions

| State | `isPartial` | File written? | DiffViewer state |
|---|---|---|---|
| `Pending` | — | No | Opening, spinner shown |
| `Streaming` | — | No | Live stream appending to right pane |
| `Complete` | false | Yes (after backup) | Final diff shown; read-only |
| `Partial` | true | No (user decides) | Partial diff with warning banner |
| `Cancelled` | — | No | Dismissed |

---

## Guard Conditions

- `Pending → Streaming`: circuit breaker must be CLOSED; rate limiter must grant token
- `Streaming → Complete`: Claude API `stop_reason` must be `end_turn` (not `max_tokens`)
- `Partial → Pending` (retry): circuit breaker must be CLOSED; rate limiter must grant token

---

## Side Effects

| Transition | Side effect |
|---|---|
| `[*] → Pending` | `orchestrator:sync-started` IPC emitted with orchestratorPath |
| `Streaming → *` per chunk | `orchestrator:sync-chunk` IPC emitted (orchestratorPath + chunkText) |
| `Streaming → Complete` | `SnapshotFileUseCase` runs on orchestrator file before write; `WriteFileUseCase` writes newContent |
| `Complete → [*]` | `config:changed` → `BuildGraphUseCase` → graph re-renders |
| `Streaming → Partial` | Circuit breaker records failure if caused by API error |

---

## Notes

- One `OrchestratorUpdate` instance is created per affected orchestrator file; multiple orchestrators are processed sequentially
- `Partial` state gives the user control — they can review the incomplete diff and choose to retry or discard
- `Complete` state always implies a backup snapshot was created before the file write
- If `stop_reason` is `max_tokens` (output truncated), the update is treated as `Partial` since the orchestrator content may be incomplete
