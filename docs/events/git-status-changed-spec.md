# Event Specification — git:status-changed

**Status:** Draft  **Date:** 2026-03-21  **Transport:** Electron IPC push (main → renderer)

## Purpose
Notifies the renderer that the Git status of a `.claude/` folder has changed — uncommitted changes exist or have been cleared. Drives the Git panel badge and commit prompt in the UI.

## Producer
`git-service` (via main) — emitted after any `config:changed` event when the `.claude/` folder is inside a Git repository, triggered by a `git status` check.

## Consumers
| Consumer | Reaction |
|---|---|
| GitPanel | Refresh changed files list and commit button state |
| StatusBar | Show/hide Git badge ("N uncommitted changes") |

## Payload Schema
```typescript
interface GitStatusChangedPayload {
  claudePath: string;           // absolute path of the .claude/ folder
  isGitRepo: boolean;           // false if .claude/ is not inside a Git repo
  branch: string | null;        // current branch name; null if not a git repo
  hasUncommittedChanges: boolean;
  changedFiles: string[];       // relative paths of changed .claude/ files (empty if no changes)
}
```

## Rules
- Emitted only when `isGitRepo: true` AND git status check completes within the 5s timeout (per resilience spec)
- If `git` is not installed or the timeout elapses, the event is **not emitted** — git-service silently disables itself; `GitPanel` remains hidden
- `changedFiles` paths are relative to `claudePath` — renderer joins with `claudePath` for display
- `hasUncommittedChanges` is `changedFiles.length > 0`; both fields are always consistent
- Event fires at most once per `config:changed` event — git-service debounces concurrent file-change events with a 500ms window before running `git status`
- `branch` is `null` only when `isGitRepo: false`
