# IPC Channels API Specification — Claude Project Manager

**Status:** Draft
**Date:** 2026-03-21
**System:** Claude Project Manager (CPM)
**Transport:** Electron IPC via typed preload bridge (`window.ipc`)
**Contract file:** `src/shared/ipc-channels.ts` (see ADR 0006)

---

## Conventions

- **Request/response** channels: renderer calls `window.ipc.invoke(channel, payload)`; main returns result via `ipcMain.handle`. Responses wrapped: `{ ok: true, ...payload }` on success; `{ ok: false, code: string, message: string }` on error.
- **Push** channels: main calls `webContents.send(channel, payload)`; renderer listens with `window.ipc.on(channel, handler)`. Push payloads are sent **directly without the `ok` wrapper** — they always represent a completed event.
- **Naming:** `<domain>:<verb>` for request/response; `<domain>:<past-tense-or-state>` for push events.

---

## 1. Project Channels

| Channel | Direction | Description |
|---|---|---|
| `project:scan` | req/res | Trigger workspace scan; returns `{ claudeFolders: ClaudeFolder[] }` |
| `project:list` | req/res | Return cached project list; returns `{ claudeFolders: ClaudeFolder[] }` |
| `project:create` | req/res | Create `.claude/` from template; payload: `{ targetDirectory, templateName }` |
| `project:discovered` | push | After scan: `{ claudeFolder: ClaudeFolder, cytoscapeElements }` |

**`project:create` errors:** `DIRECTORY_NOT_FOUND` · `CLAUDE_FOLDER_EXISTS` · `TEMPLATE_NOT_FOUND`

---

## 2. File Channels

| Channel | Direction | Description |
|---|---|---|
| `file:read` | req/res | Read file; payload: `{ filePath }`; returns `{ content, lastModifiedAt }` |
| `file:write` | req/res | Backup + write; payload: `{ filePath, content }`; returns `{ snapshot: Snapshot }` |
| `file:delete` | req/res | Backup + delete; payload: `{ filePath }`; returns `{ snapshot: Snapshot }` |
| `config:changed` | push | Any file change: `{ filePath, changeType: 'write'\|'delete'\|'external', correlationId }` |

**`file:write`/`file:delete` errors:** `BACKUP_FAILED` (aborts write) · `WRITE_PERMISSION_DENIED` · `PATH_TRAVERSAL`

---

## 2b. File Structure Channels

| Channel | Direction | Payload | Response |
|---|---|---|---|
| `file:update-section` | req/res | `{ filePath, sectionHeading, newContent }` | `{}` |
| `file:delete-section` | req/res | `{ filePath, sectionHeading }` | `{}` |
| `file:add-section` | req/res | `{ filePath, sectionHeading, content, afterSection? }` | `{}` |
| `file:add-item` | req/res | `{ filePath, sectionHeading, itemContent, afterIndex? }` | `{ itemIndex: number }` |
| `file:update-item` | req/res | `{ filePath, sectionHeading, itemIndex, newContent }` | `{}` |
| `file:delete-item` | req/res | `{ filePath, sectionHeading, itemIndex }` | `{}` |
| `file:reorder-item` | req/res | `{ filePath, sectionHeading, fromIndex, toIndex }` | `{}` |

**Section names:** `Purpose` · `Instructions` · `Constraints` · `Rules` · `Examples` · `Additions` · `Overrides` · `Exclusions`
**Section applicability:** `Instructions`, `Constraints` → skill files only · `Rules` → rule files only · `Additions`, `Overrides`, `Exclusions` → supplement files only · `Purpose`, `Examples` → all file types
**List format per section:** `Instructions`, `Rules`, `Additions`, `Overrides`, `Exclusions` → numbered (`1.`, `2.`, …), auto-renumbered on insert/delete. `Constraints` → bullet (`-`), positional index only.
**`file:delete-section` errors:** `SECTION_REQUIRED` (Purpose, Instructions for skills; Purpose, Rules for rules) · `SECTION_NOT_FOUND`
**`file:add-item` / `file:update-item` / `file:delete-item` errors:** `SECTION_NOT_FOUND` · `ITEM_INDEX_OUT_OF_RANGE`
**All section/item mutations:** backup snapshot taken before write; emits `config:changed` after write.

---

## 3. Toggle Channels

| Channel | Direction | Payload | Response |
|---|---|---|---|
| `skill:toggle` | req/res | `{ filePath, enabled: boolean }` | `{ skillNode: SkillNode }` |
| `rule:toggle` | req/res | `{ filePath, enabled: boolean }` | `{ filePath, isEnabled: boolean }` |
| `hook:toggle` | req/res | `{ filePath, enabled: boolean }` | `{ filePath, isEnabled: boolean }` |

**Errors:** `FILE_NOT_FOUND` · `FRONTMATTER_PARSE_ERROR`

---

## 3b. Skill & Rule CRUD Channels

| Channel | Direction | Payload | Response |
|---|---|---|---|
| `skill:create` | req/res | `{ claudePath, slug, name, description }` | `{ filePath }` |
| `skill:delete` | req/res | `{ claudePath, slug }` | `{}` |
| `rule:create` | req/res | `{ claudePath, slug, name, description, paths? }` | `{ filePath }` |
| `rule:delete` | req/res | `{ claudePath, slug }` | `{}` |
| `skill:validate-structure` | req/res | `{ filePath }` | `{ valid: boolean, missingSections: string[], malformedSections: string[] }` |

**`skill:create`/`rule:create`:** Creates file with frontmatter populated from inputs + section scaffold. After create, emits `config:changed`.
**`skill:delete`/`rule:delete`:** Takes backup snapshot before deletion. Emits `config:changed`.
**`skill:create` errors:** `SLUG_EXISTS` · `INVALID_SLUG` (non-alphanumeric-hyphen)
**`rule:create` errors:** `SLUG_EXISTS` · `INVALID_SLUG`
**`skill:delete`/`rule:delete` errors:** `NOT_FOUND` · `BACKUP_FAILED`

---

## 3c. Rule Inheritance Channels

| Channel | Direction | Payload | Response |
|---|---|---|---|
| `rule:list-global` | req/res | `{}` | `{ rules: { slug, name, description, filePath }[] }` |
| `rule:get-hierarchy` | req/res | `{ claudePath }` | `{ hierarchy: RuleHierarchy[] }` |
| `rule:create-supplement` | req/res | `{ claudePath, globalSlug }` | `{ filePath }` |
| `rule:hierarchy-updated` | push | — | `{ claudePath, hierarchy: RuleHierarchy[] }` |

**`RuleHierarchy`:** `{ slug: string, globalPath: string, supplementPath: string | null, isGlobalEnabled: boolean, isSupplementEnabled: boolean | null }`
**`rule:list-global`:** reads `~/.claude/rules/*.md`; returns slug (filename stem), name and description from frontmatter
**`rule:create-supplement`:** creates `.claude/rules/<globalSlug>.md` with supplement template (supplements frontmatter field + Additions/Overrides/Exclusions scaffold); backup on overwrite
**`rule:hierarchy-updated`:** push emitted by main-process after `ResolveRuleHierarchyUseCase` re-runs on any rule file change; renderer uses this to update `RulesHooksView` without polling.
**`rule:create-supplement` errors:** `SUPPLEMENT_EXISTS` · `GLOBAL_NOT_FOUND` · `BACKUP_FAILED`

---

## 4. Graph Channels

| Channel | Direction | Description |
|---|---|---|
| `skill:validate` | req/res | On-demand validation; payload: `{ claudePath }`; returns `{ validation: GraphValidation }` |
| `graph:updated` | push | After every `config:changed`: `{ claudePath, elements: { nodes, edges }, validation, buildDurationMs }` |

**`CyNode.data`:** `{ id, label, description, isEnabled, isMissingFrontmatter, hasError, mcpServers, filePath }`
**`CyEdge.data`:** `{ id, source, target, isBroken }`

---

## 5. Suggestion Channels

| Channel | Direction | Payload | Response / Push payload |
|---|---|---|---|
| `suggestion:request` | req/res | `{ skillNode: SkillNode, fileContent: string }` | `{ suggestions: Suggestion[] }` |
| `suggestion:ready` | push | — | `{ affectedSlug, suggestions[], modelUsed, inputTokens, generatedAt }` |

**Errors:** `AUTH_INVALID` · `CIRCUIT_OPEN` · `RATE_LIMITED` (includes `retryAfterSeconds`) · `API_ERROR`

---

## 6. Orchestrator Sync Channels

| Channel | Direction | Push payload |
|---|---|---|
| `orchestrator:sync-started` | push | `{ orchestratorPaths: string[], modifiedSlug: string }` |
| `orchestrator:sync-chunk` | push | `{ orchestratorPath: string, chunkText: string }` |
| `orchestrator:sync-completed` | push | `{ modifiedSlug, updatedPaths[], partialPaths[], failedPaths[], totalDurationMs }` |

---

## 7. Backup Channels

| Channel | Direction | Payload | Response |
|---|---|---|---|
| `backup:list` | req/res | `{ filePath }` | `{ snapshots: Snapshot[] }` |
| `backup:rollback` | req/res | `{ snapshot: Snapshot }` | `{ restoredContent, preRollbackSnapshot }` |
| `backup:created` | push | — | `{ snapshot: Snapshot }` |
| `rollback:completed` | push | — | `{ filePath, restoredContent, restoredFromSnapshot, preRollbackSnapshot, correlationId }` |

**`backup:rollback` errors:** `SNAPSHOT_NOT_FOUND` · `PRE_ROLLBACK_BACKUP_FAILED`

---

## 8. Auth Channels

| Channel | Direction | Payload | Response |
|---|---|---|---|
| `auth:validate` | req/res | `{ apiKey?: string }` | `{ authState: AuthState }` |
| `auth:state-changed` | push | — | `{ authState: AuthState, reason }` |

**`reason` values:** `startup` · `key-submitted` · `api-401` · `api-403` · `circuit-open` · `circuit-closed` · `key-deleted`

---

## 9. MCP Channels

| Channel | Direction | Payload | Response |
|---|---|---|---|
| `mcp:list-marketplace` | req/res | `{}` | `{ modules: McpModule[], fromCache, cacheAgeMs? }` |
| `mcp:list-local` | req/res | `{ claudePath }` | `{ installations: McpInstallation[] }` |
| `mcp:install` | req/res | `{ module, configValues, authKey? }` | `{ installation: McpInstallation }` |
| `mcp:uninstall` | req/res | `{ moduleName, claudePath }` | `{}` |
| `mcp:toggle` | req/res | `{ moduleName, enabled, claudePath }` | `{ installation: McpInstallation }` |
| `mcp:set-auth-key` | req/res | `{ moduleName, authKey }` | `{}` |
| `mcp:validate-compatibility` | req/res | `{ module: McpModule }` | `{ result: CompatibilityResult }` |

**`mcp:install` errors:** `CONFIG_VALIDATION_FAILED` · `FILE_WRITE_FAILED` · `KEYCHAIN_WRITE_FAILED`

---

## 10. Git Channels

| Channel | Direction | Payload | Response / Push payload |
|---|---|---|---|
| `git:status` | req/res | `{ claudePath }` | `{ isGitRepo, branch?, hasUncommittedChanges?, changedFiles? }` |
| `git:commit` | req/res | `{ claudePath, message, files[] }` | `{ commitHash }` |
| `git:status-changed` | push | — | `{ claudePath, isGitRepo, branch?, hasUncommittedChanges, changedFiles[] }` |

**`git:commit` errors:** `NOT_A_GIT_REPO` · `NOTHING_TO_COMMIT` · `GIT_COMMAND_FAILED`

**Notes:** `git:status` is an on-demand query; `git:status-changed` is a push event emitted by `git-service` after each `config:changed` (debounced 500ms). Both share the same payload shape.

---

## 11. Logging Channel

| Channel | Direction | Payload |
|---|---|---|
| `log:error` | renderer → main | `{ message, stack?, component }` |

---

## Security

- All `filePath` values validated against allowed workspace roots in main process (path traversal prevention)
- API keys never present in any IPC payload — only boolean flags (`keyPresent`, `hasAuthKey`)
- `log:error` payloads sanitised to strip `sk-ant-*` patterns before writing to log file
- Renderer: `contextIsolation=true`, `nodeIntegration=false` — all IPC through `window.ipc` preload bridge only
