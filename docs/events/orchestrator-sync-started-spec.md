# Event Specification — orchestrator:sync-started

**Status:** Draft  **Date:** 2026-03-21  **Transport:** Electron IPC push (main → renderer)

## Purpose
Notifies the renderer that orchestrator sync has begun for a modified skill. Provides the list of orchestrator file paths that will be rewritten so the renderer can show a progress indicator and lock those files in the editor.

## Producer
`ai-suggestion-service` (via main) — emitted at the start of `SyncOrchestratorUseCase`, after `FindOrchestratorsUseCase` has identified the affected orchestrators and before the first Claude API streaming call begins.

## Consumers
| Consumer | Reaction |
|---|---|
| SuggestionStore | Set `syncInProgress: true`; store `orchestratorPaths` list |
| SplitEditorView | Show "Sync in progress…" banner on orchestrator file tabs |
| GraphStore | Dim edges from the modified skill node during sync |
| StatusBar | Show sync spinner with count: "Updating N orchestrator(s)…" |

## Payload Schema
```typescript
interface OrchestratorSyncStartedPayload {
  modifiedSlug: string;         // slug of the skill that was modified
  orchestratorPaths: string[];  // absolute paths of orchestrator files to be rewritten
  correlationId: string;        // links all sync-chunk and sync-completed events for this sync
}
```

## Rules
- `orchestratorPaths` will never be empty — if no orchestrators are found, this event is not emitted (sync is skipped silently)
- `correlationId` is shared with all subsequent `orchestrator:sync-chunk` and `orchestrator:sync-completed` events for the same sync operation
- Renderer must treat this as a signal to disable manual editing of files in `orchestratorPaths` until `orchestrator:sync-completed` fires
- Emitted at most once per `file:write` IPC call — a single skill modification triggers one sync operation, even if multiple orchestrators are affected
- `orchestratorPaths` contains only paths of **enabled** orchestrators — disabled skills are excluded by `FindOrchestratorsUseCase`
