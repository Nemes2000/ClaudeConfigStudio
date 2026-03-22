# Service Specification — main-process

**Status:** Draft
**Date:** 2026-03-21
**Owner:** TBD
**System:** Claude Project Manager (CPM)
**Stack:** Node.js 20 LTS · Electron 30 · TypeScript 5

---

## 1. Bounded Context

**Responsibility:** Owns the Electron main process — the trusted host process that has full Node.js and OS access. Orchestrates application lifecycle, manages all filesystem I/O for `.claude/` folders, registers all IPC handlers, coordinates workspace scanning, and acts as the composition root wiring all backend service modules together.

**Does not own:**
- UI rendering (renderer-process)
- Dependency graph logic (skill-graph-service)
- AI calls (ai-suggestion-service)
- Backup snapshots (backup-service)
- MCP operations (mcp-manager)

---

## 2. Responsibilities

- Application startup, window management, and graceful shutdown
- Workspace directory scanning — discovers all `.claude/` folders under configured root paths
- Filesystem watching via `chokidar` — emits `config:changed` IPC events on file modification
- IPC handler registration — all `ipcMain.handle()` calls live here; handlers delegate to service modules
- Template management — ships default `.claude/` structure templates for new project creation
- Config file read/write orchestration — delegates writes to `backup-service` (snapshot first) then writes to disk
- Pre-commit hook installation for secret scanning in Git-tracked `.claude/` folders

---

## 3. Hexagonal Layer Boundaries

```
main-process (composition root)
├── domain/       — WorkspaceFolder, ClaudeFolder, FileEntry value objects
├── application/  — ScanWorkspaceUseCase, WatchFolderUseCase, WriteFileUseCase
└── infrastructure/
    ├── ipc/      — IPC handler registrations (delegates to use cases)
    ├── fs/       — chokidar watcher, fs.promises wrappers
    └── templates/ — default .claude/ structure templates
```

Layer import rule: domain ← application ← infrastructure. IPC handlers are infrastructure — they call application use cases only, never domain directly.

---

## 4. IPC Channels Owned

| Channel | Direction | Description |
|---|---|---|
| `project:scan` | renderer → main | Trigger workspace scan for `.claude/` folders |
| `project:list` | renderer → main | Return cached list of discovered projects |
| `project:create` | renderer → main | Create new `.claude/` structure from template |
| `file:read` | renderer → main | Read a `.claude/` file by path |
| `file:write` | renderer → main | Write a file (triggers backup then disk write) |
| `file:delete` | renderer → main | Delete a `.claude/` file |
| `project:discovered` | main → renderer | Push new project discovery results |
| `config:changed` | main → renderer | Notify renderer of a file change on disk |
| `skill:toggle` | renderer → main | Enable or disable a skill (writes frontmatter) |
| `rule:toggle` | renderer → main | Enable or disable a rule (writes frontmatter) |
| `hook:toggle` | renderer → main | Enable or disable a hook (writes frontmatter) |
| `skill:create` | renderer → main | Create a new skill file with frontmatter + scaffold |
| `skill:delete` | renderer → main | Delete a skill directory with backup snapshot |
| `rule:create` | renderer → main | Create a new rule file with frontmatter + scaffold |
| `rule:delete` | renderer → main | Delete a rule file with backup snapshot |
| `rule:list-global` | renderer → main | List all rules in `~/.claude/rules/` |
| `rule:get-hierarchy` | renderer → main | Get rule hierarchy (global + supplements) for project |
| `rule:create-supplement` | renderer → main | Create project-level rule supplement |
| `file:update-section` | renderer → main | Replace content in a named ## section |
| `file:delete-section` | renderer → main | Remove a named ## section |
| `file:add-section` | renderer → main | Insert a new ## section at position |
| `file:add-item` | renderer → main | Add item to a list section (auto-renumber numbered sections) |
| `file:update-item` | renderer → main | Replace item at index in a list section |
| `file:delete-item` | renderer → main | Remove item at index (renumber numbered sections) |
| `file:reorder-item` | renderer → main | Move item from index to index (renumber numbered sections) |
| `skill:validate-structure` | renderer → main | Validate that skill file has required sections |

All channels typed via `src/shared/ipc-channels.ts` (see ADR 0006).

---

## 5. Domain Models

```typescript
// WorkspaceFolder — a root directory the user has configured for scanning
interface WorkspaceFolder {
  path: string;          // absolute path
  label: string;         // display name
}

// ClaudeFolder — a discovered .claude/ directory
interface ClaudeFolder {
  projectPath: string;   // absolute path of the parent project
  claudePath: string;    // absolute path of the .claude/ folder
  isRootLevel: boolean;  // true if .claude/ is at workspace root, not inside a project
  contents: ClaudeFolderContents;
}

// ClaudeFolderContents — parsed index of what's inside .claude/
// File structure follows Claude Code convention: one directory per entity
interface ClaudeFolderContents {
  skills: string[];      // paths to SKILL.md files: skills/<name>/SKILL.md
  rules: string[];       // paths to RULE.md files: rules/<name>.md (flat file)
  hooks: string[];       // paths to HOOK.md (or .sh) files: hooks/<name>/HOOK.md
  mcps: string[];        // paths to MCP config dirs: mcp/<name>/
  agentConfig: string | null;  // agent.yaml / agent.json path if present
}
```

---

## 6. Key Use Cases

### ScanWorkspaceUseCase
- Input: `WorkspaceFolder[]` from app settings
- Action: recursively find all `.claude/` directories; parse `ClaudeFolderContents` for each
- Output: `ClaudeFolder[]`; emits `project:discovered` IPC event

### WatchFolderUseCase
- Input: `claudePath`
- Action: start `chokidar` watcher on path; on change emit `config:changed` IPC with the changed file path
- Lifecycle: watcher started after scan; stopped on window close

### WriteFileUseCase
- Input: absolute file path + new content string
- Action: call `backup-service.snapshot(path)` → write new content via `fs.promises.writeFile` → emit `config:changed`
- Error: if backup fails, abort write and surface error to renderer

### ToggleSkillUseCase / ToggleRuleUseCase / ToggleHookUseCase
- Input: absolute path to `SKILL.md` / `RULE.md` / `HOOK.md` + `enabled: boolean`
- Action:
  1. Read current file content
  2. Parse frontmatter via `gray-matter`
  3. If `enabled === false`: set `data.enabled = false` in frontmatter; write back
  4. If `enabled === true`: delete `data.enabled` key from frontmatter (restore clean default); write back
  5. Write is wrapped in `WriteFileUseCase` (snapshot first)
  6. Emit `config:changed`
- Output: void
- Note: the `enabled` field is removed entirely on re-enable — files stay clean by default

### CreateProjectUseCase
- Input: target directory path + template name
- Action: copy template from `infrastructure/templates/` to target; call `ScanWorkspaceUseCase` to register

### File-level CRUD

#### CreateSkillUseCase
- Input: `{ claudePath, slug, name, description }`
- Action: creates `skills/<slug>/SKILL.md` with frontmatter (name, description, version, enabled) + section scaffold (Purpose, Instructions, Constraints placeholders); writes with backup
- Output: `{ filePath, content }`

#### DeleteSkillUseCase
- Input: `{ claudePath, slug }`
- Action: snapshot backup → delete `skills/<slug>/` directory recursively; emits `config:changed`
- Output: void

#### CreateRuleUseCase
- Input: `{ claudePath, slug, name, description, paths? }`
- Action: creates `rules/<slug>.md` (flat file) with frontmatter (name, description, paths glob, version, enabled) + section scaffold (Purpose, Rules placeholders); writes with backup
- Output: `{ filePath, content }`

#### DeleteRuleUseCase
- Input: `{ claudePath, slug }`
- Action: snapshot backup → delete `rules/<slug>.md`; emits `config:changed`
- Output: void

### Rule Inheritance

#### CreateRuleSupplementUseCase
- Input: `{ claudePath, globalSlug }`
- Action: creates `.claude/rules/<globalSlug>.md` with supplement template (supplements frontmatter field + Additions/Overrides/Exclusions section scaffold); writes with backup
- Output: `{ filePath, content }`

#### ResolveRuleHierarchyUseCase
- Input: `{ claudePath }`
- Action: reads all rule filenames from `~/.claude/rules/` and `.claude/rules/`; matches by filename stem → returns `RuleHierarchy[]` (one entry per global rule with optional project supplement)
- Output: `RuleHierarchy[] = { slug: string, globalPath: string, supplementPath: string | null, isGlobalEnabled: boolean, isSupplementEnabled: boolean | null }[]`
  - `isSupplementEnabled` is `null` when no supplement file exists; `true`/`false` when supplement file present
  - After computing, emits `rule:hierarchy-updated` push event to renderer

#### ValidateSkillStructureUseCase
- Input: `{ filePath }`
- Action: reads file, detects file type (skill if under `skills/`, rule if under `rules/`), checks for required `##` sections via regex; required sections: `Purpose` + `Instructions` for skills; `Purpose` + `Rules` for rules
- Output: `{ valid: boolean, missingSections: string[], malformedSections: string[] }`
- Delegates section detection to the same regex used by `skill-graph-service` `BuildGraphUseCase`

### Section-level CRUD

#### UpdateFileSectionUseCase
- Input: `{ filePath, sectionHeading, newContent }`
- Action: reads file, replaces content between `## <heading>` and next `##` (or EOF), writes with backup
- Output: void

#### DeleteFileSectionUseCase
- Input: `{ filePath, sectionHeading }`
- Action: removes `## <heading>` block; rejects required sections with `SECTION_REQUIRED` error
- Output: void

#### AddFileSectionUseCase
- Input: `{ filePath, sectionHeading, content, afterSection? }`
- Action: inserts new `## <heading>` block at specified position; writes with backup
- Output: void

### Item-level CRUD

#### AddItemUseCase
- Input: `{ filePath, sectionHeading, itemContent, afterIndex? }`
- Action: inserts list item; auto-renumbers numbered sections (Instructions, Rules, Additions, Overrides, Exclusions); bullet sections (Constraints) use positional index; writes with backup
- Output: void

#### UpdateItemUseCase
- Input: `{ filePath, sectionHeading, itemIndex, newContent }`
- Action: replaces item at index N; writes with backup
- Output: void

#### DeleteItemUseCase
- Input: `{ filePath, sectionHeading, itemIndex }`
- Action: removes item at index N; renumbers numbered sections; writes with backup
- Output: void

#### ReorderItemUseCase
- Input: `{ filePath, sectionHeading, fromIndex, toIndex }`
- Action: moves item; renumbers numbered sections; writes with backup
- Output: void

---

## 7. Dependencies

| Dependency | Type | Purpose |
|---|---|---|
| backup-service | internal module | Snapshot files before every write |
| skill-graph-service | internal module | Trigger graph re-parse on `config:changed` |
| ai-suggestion-service | internal module | Forward file-write events for orchestrator sync |
| git-service | internal module | Pre-commit hook setup; Git status checks |
| chokidar | npm | Filesystem watching |
| electron | runtime | IPC, app lifecycle, window management |

---

## 8. Security

- Renderer has `contextIsolation=true`, `nodeIntegration=false` — no direct filesystem access from renderer
- All file paths validated against allowed workspace roots before read/write (path traversal prevention)
- Template files are bundled with the app — never fetched from network
- Pre-commit hook warns on API key patterns in `.claude/` files before Git commit

---

## 9. Observability

- Structured JSON logs via `electron-log`: `{ timestamp, level, component: "main-process", correlation_id, message }`
- Log on every IPC handler invocation at DEBUG level
- Log on every file write at INFO level with path (never content)
- Log on watcher errors at ERROR level

---

## 10. Error Handling

- All IPC handlers wrapped in try/catch; errors serialized to `{ code, message }` and returned to renderer — never crash the main process
- File write failures: backup-service failure aborts write; disk write failure attempts rollback to snapshot
- Watcher restart: if chokidar emits error, log and restart watcher with exponential backoff (max 3 attempts)
