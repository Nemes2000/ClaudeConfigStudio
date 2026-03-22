# Event Specification — project:discovered

**Status:** Draft  **Date:** 2026-03-21  **Transport:** Electron IPC push (main → renderer)

## Purpose
Notifies the renderer that a `.claude/` folder has been discovered (or re-scanned) during workspace scan. Delivers the full folder structure so the renderer can populate the project list and trigger graph rendering without a separate `project:list` round-trip.

## Producer
`main-process` — emitted by `ScanWorkspaceUseCase` for each discovered `ClaudeFolder`, and by `WatchFolderUseCase` when a new `.claude/` directory appears while watching.

## Consumers
| Consumer | Reaction |
|---|---|
| WorkspaceStore | Upsert `ClaudeFolder` into project list |
| ProjectSidebar | Render or update project entry |
| GraphStore | Trigger `skill:parse-graph` IPC for the new project |

## Payload Schema
```typescript
interface ProjectDiscoveredPayload {
  claudeFolder: {
    projectPath: string;        // absolute path of parent project directory
    claudePath: string;         // absolute path of .claude/ folder
    isRootLevel: boolean;       // true if .claude/ is at workspace root
    contents: {
      skills: string[];         // relative paths: skills/<name>/SKILL.md
      rules: string[];          // relative paths: rules/<name>/RULE.md
      hooks: string[];          // relative paths: hooks/<name>/HOOK.md
      mcps: string[];           // relative paths: mcp/<name>/
      agentConfig: string | null;
    };
  };
  cytoscapeElements: {
    nodes: CyNode[];
    edges: CyEdge[];
  } | null;                     // null if no skills parsed yet (empty .claude/)
  correlationId: string;        // matches the triggering project:scan request
}
```

## Rules
- `correlationId` must match the `correlationId` in the originating `project:scan` invoke call
- `cytoscapeElements` is `null` for newly created empty projects; renderer must handle gracefully
- Multiple `project:discovered` events may fire in sequence for a single scan (one per found folder)
- If the same `claudePath` is discovered again (re-scan), `WorkspaceStore` must upsert, not duplicate
- `contents` file paths are relative to `claudePath` — renderer must join with `claudePath` for absolute paths
- File paths must not contain traversal sequences (`../`)
