# Service Specification — git-service

**Status:** Draft
**Date:** 2026-03-21
**Owner:** TBD
**System:** Claude Project Manager (CPM)
**Stack:** Node.js 20 LTS · TypeScript 5 · simple-git · in-process module

---

## 1. Bounded Context

**Responsibility:** Provides Git integration for `.claude/` folders that are inside a Git repository. Detects Git state (branch, uncommitted changes, changed files) and executes commits of `.claude/` changes on user request. Non-critical — all local features work when Git is unavailable.

**Does not own:**
- Filesystem writes to `.claude/` files (main-process)
- UI for the Git panel (renderer-process)
- Backup snapshots (backup-service)

---

## 2. Responsibilities

- Detect whether a `.claude/` folder is inside a Git repository
- Return current branch and list of uncommitted changes within `.claude/`
- Commit a user-specified set of `.claude/` files with a structured commit message
- Emit `git:status-changed` push event after every `config:changed` (debounced 500ms)

---

## 3. Hexagonal Layer Boundaries

```
git-service (in-process module)
├── domain/
│   └── GitStatus   — value object: isGitRepo, branch, hasUncommittedChanges, changedFiles
├── application/
│   ├── GetGitStatusUseCase  — run git status; return GitStatus
│   └── CommitChangesUseCase — stage specified files; create commit
└── infrastructure/
    └── SimpleGitClient      — wraps simple-git; enforces 5s timeout
```

---

## 4. Domain Models

```typescript
interface GitStatus {
  isGitRepo: boolean;
  branch: string | null;
  hasUncommittedChanges: boolean;
  changedFiles: string[];        // relative paths within .claude/
}
```

No aggregate root. `GitStatus` is a stateless query result — not persisted.

---

## 5. Key Use Cases

### GetGitStatusUseCase
- Input: `claudePath` (absolute path of `.claude/` folder)
- Action:
  1. Detect Git root via `simple-git(claudePath).revparse('--show-toplevel')` — timeout 5s
  2. If not a repo: return `{ isGitRepo: false, branch: null, hasUncommittedChanges: false, changedFiles: [] }`
  3. Run `git status --short` scoped to `claudePath`
  4. Parse output into `changedFiles` (relative to `claudePath`)
- Output: `GitStatus`
- On timeout or `git` not found: return `{ isGitRepo: false, ... }`; log WARN once per session

### CommitChangesUseCase
- Input: `claudePath` + `files: string[]` (relative paths) + `message: string`
- Action:
  1. Stage each file: `git add <file>` within Git root
  2. Commit: `git commit -m "<message>"`
- Output: `{ commitHash: string }`
- Validation: `files` must be non-empty; `message` must be non-empty string ≤ 72 chars

---

## 6. IPC Channels Served

| Channel | Caller | Response |
|---|---|---|
| `git:status` | renderer | `GitStatus` |
| `git:commit` | renderer | `{ commitHash: string }` |
| `git:status-changed` | this → renderer | push: `GitStatusChangedPayload` (see event spec) |

---

## 7. Dependencies

| Dependency | Type | Purpose |
|---|---|---|
| simple-git | npm | Git command wrapper |
| main-process | internal | Subscribes to `config:changed` to trigger status refresh |

No network calls. No filesystem writes. Git operations are read-only except for `CommitChangesUseCase`.

---

## 8. Resilience

- **Timeout:** 5s on all `simple-git` calls (per resilience spec)
- **Retry:** none — git operations are fast; failure means Git not installed or repo not accessible
- **Failure mode:** if `git` not found in PATH or timeout elapses, `git-service` disables itself for the session; `GitPanel` hidden in renderer; no error surfaced to user (non-critical feature)
- **Debounce:** status refresh debounced 500ms after `config:changed` — avoids redundant `git status` calls during rapid file saves

---

## 9. Observability

- Log `GetGitStatusUseCase` at DEBUG: `{ component: "git-service", claudePath, isGitRepo, changedFileCount }`
- Log `CommitChangesUseCase` at INFO: `{ component: "git-service", claudePath, fileCount, commitHash }`
- Log Git not found at WARN once per session (do not repeat on every file change)

---

## 10. Error Handling

| Error | Behaviour |
|---|---|
| `git` not in PATH | Log WARN once; disable git-service for session; `GitPanel` hidden |
| 5s timeout on status check | Log WARN; return `isGitRepo: false`; continue |
| `git commit` fails (nothing to commit) | Return `{ ok: false, code: "NOTHING_TO_COMMIT" }` |
| `git commit` fails (other) | Return `{ ok: false, code: "GIT_COMMAND_FAILED", message }` |
