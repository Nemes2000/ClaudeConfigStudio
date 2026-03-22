# Event Specification — orchestrator:sync-completed

**Status:** Draft  **Date:** 2026-03-21  **Transport:** Electron IPC push (main → renderer)

## Purpose
Signals that orchestrator sync has finished for all affected skill files after a dependency skill was modified. Renderer finalises DiffViewer and shows summary.

## Preceding events (in order)
1. `orchestrator:sync-started` — DiffViewer opens
2. `orchestrator:sync-chunk` × N — streaming diff chunks per orchestrator
3. **`orchestrator:sync-completed`** — this event

## Producer
`ai-suggestion-service` (via main) — emitted after `SyncOrchestratorUseCase` processes all orchestrators.

## Consumers
| Consumer | Reaction |
|---|---|
| DiffViewer | Finalise diff; show accept/discard for partial results |
| StatusBar | Clear "Syncing…" indicator |
| SuggestionSidebar | Refresh suggestions for updated orchestrators |

## Payload Schema
```typescript
interface OrchestratorSyncCompletedPayload {
  modifiedSlug: string;
  updatedPaths: string[];   // successfully rewritten (isPartial=false)
  partialPaths: string[];   // incomplete output (isPartial=true); already written with backup
  failedPaths: string[];    // API call failed; unchanged on disk
  totalDurationMs: number;
}
```

## Rules
- A path appears in exactly one of `updatedPaths`, `partialPaths`, or `failedPaths`
- `updatedPaths` entries will trigger `config:changed` (file was written) — renderer must not double-process
- `partialPaths`: content written to disk; renderer shows warning diff + retry option
- `failedPaths`: unchanged on disk; renderer shows error state + per-orchestrator retry button
- `partialPaths` occur when `stop_reason=max_tokens` or stream timeout (120s)
