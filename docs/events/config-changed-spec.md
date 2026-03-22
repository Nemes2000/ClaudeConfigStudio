# Event Specification — config:changed

**Status:** Draft  **Date:** 2026-03-21  **Transport:** Electron IPC push (main → renderer)

## Purpose
Central nervous system event — notifies all consumers that a `.claude/` file changed on disk. Triggers graph rebuild, suggestion invalidation, and editor conflict detection.

## Producer
`main-process` — emitted after `WriteFileUseCase`, `file:delete`, or `chokidar` external-change detection. Debounced 100ms on watcher events to prevent storms.

## Consumers
| Consumer | Reaction |
|---|---|
| skill-graph-service | Rebuild DependencyGraph; emit `graph:updated` |
| main-process | Re-run `ResolveRuleHierarchyUseCase` if changed file is under `rules/` (either global `~/.claude/rules/` or project `.claude/rules/`); emit updated hierarchy to renderer |
| ai-suggestion-service | Invalidate cached suggestions for changed file |
| EditorStore | Detect conflict if changed file is open and `isDirty=true` |
| BackupHistoryView | Refresh snapshot list if changed file is in history panel |

## Payload Schema
```typescript
interface ConfigChangedPayload {
  filePath: string;          // absolute path within workspace
  changeType: 'write' | 'delete' | 'external';
  correlationId: string;     // UUID from originating IPC call; null for external changes
}
```

## Rules
- `changeType: 'delete'` → skill-graph-service removes node, marks reverse edges as `BrokenRef`
- `changeType: 'external'` → correlationId is null
- `BuildGraphUseCase` is idempotent — safe on duplicate events
- Watcher debounce: 100ms (`chokidar` `awaitWriteFinish` option)
