# System Specification — Claude Project Manager

**Status:** Draft
**Date:** 2026-03-21
**Owner:** TBD
**SLA targets:** Availability 99.5% · p99 latency 200ms (local file ops) · RPO N/A (local app) · RTO N/A (local app)

---

## 1. Purpose & Scope

**Problem statement:** Managing `.claude` folder configurations across multiple local development projects is error-prone, fragmented, and inaccessible to non-expert users. Claude Project Manager (CPM) provides a unified desktop dashboard to create, visualize, validate, and evolve Claude agent configurations — skills, rules, hooks, MCPs, and agent profiles — across all local projects from a single interface. A valid Claude subscription or Anthropic API key is required for all core functionality.

**Bounded contexts included:**
- **ProjectDiscovery** — scanning the filesystem for `.claude` directories and grouping them by project
- **SkillManagement** — modeling, visualizing, editing, and CRUD of skills (`skills/<name>/SKILL.md`); dependency graph from frontmatter; section and item-level editing
- **OrchestratorSync** — detecting which orchestrator skills reference a modified skill and rewriting them via Claude API
- **RulesAndHooks** — creating, validating, editing, and previewing rules (flat files) and hook scripts; CRUD at file, section, and item level
- **RuleInheritance** — resolving project-level rule supplements against global rules; showing the hierarchy in the UI
- **MCPManagement** — browsing, installing, configuring, and validating MCP modules
- **AgentConfiguration** — defining agent identity, prompts, bindings, and context strategies
- **AIAssistance** — delivering AI-powered suggestions, linting, and improvement hints via Claude API
- **BackupAndRestore** — snapshotting every file before modification and enabling per-file rollback
- **VersionControl** — detecting Git state and optionally committing `.claude` changes as tracked commits

**Out of scope:**
- Cloud sync or collaborative multi-user editing (future direction)
- Hosting or running Claude models directly
- Managing non-`.claude` project files or arbitrary IDE configuration
- Any database or persistent state store — the filesystem is the sole source of truth

---

## 2. Service Map

This is a desktop application — there are no independently deployed microservices. The architecture is split into frontend and backend processes within the Electron shell. **There is no database.** All state lives in `.claude/` folder files on disk.

| Component | Bounded context | Stack | Repo | Owner |
|---|---|---|---|---|
| renderer-process | All UI contexts | React 18 + TypeScript + Vite | TBD | TBD |
| main-process | ProjectDiscovery, BackupAndRestore, RulesAndHooks | Node.js (Electron main) | TBD | TBD |
| skill-graph-service | SkillManagement, OrchestratorSync | Node.js + in-process | TBD | TBD |
| mcp-manager | MCPManagement | Node.js + in-process | TBD | TBD |
| ai-suggestion-service | AIAssistance, OrchestratorSync | Node.js + Claude API (Anthropic SDK) | TBD | TBD |
| backup-service | BackupAndRestore | Node.js + in-process | TBD | TBD |
| git-service | VersionControl | Node.js + simple-git | TBD | TBD |

> **Note on config-parser:** `config-parser` is not a separate deployable module — it is an internal sub-layer of `main-process` responsible for YAML/JSON file I/O within `.claude/` folders. It has no independent IPC handlers or domain model. All references to "config-parser" in data flows should be read as "main-process file I/O layer".

**Architecture style:** Clean architecture within each backend service module. Renderer communicates with main process via Electron IPC (typed channels). No direct filesystem access from renderer — all I/O goes through IPC handlers in main process.

**Service mesh / API gateway:** Not applicable (desktop app). IPC replaces HTTP service-to-service communication.

---

## 3. Dependency Graph

```
[Renderer Process (React UI)]
        │
        │ Electron IPC (typed channels)
        ▼
[Main Process (Node.js)]
        ├──► [file I/O layer]         — reads/writes .claude files; no DB (internal to main-process)
        ├──► [skill-graph-service]   — parses deps from skill file content; detects orchestrator refs
        ├──► [ai-suggestion-service] ──► [Claude API (Anthropic)]  ← REQUIRED
        │       └── rewrites orchestrator skill files when a dependency changes
        ├──► [backup-service]        — snapshots files before every write; enables rollback
        ├──► [mcp-manager]           — MCP marketplace + local MCP config
        ├──► [git-service]           ──► [local Git repos via simple-git]
        └──► [Filesystem (local)]    — .claude/ folders (sole source of truth)
                └── .claude/.backups/<filename>/<timestamp>.md  (backup snapshots)
```

### External dependencies

| System | Type | Criticality | Fallback behaviour |
|---|---|---|---|
| Claude API (Anthropic) | REST (HTTPS) | **Critical** | App blocked at startup; all AI features and orchestrator sync unavailable without valid API key or subscription |
| MCP Marketplace (remote registry) | REST (HTTPS) | Non-critical | Local MCP management still works; marketplace browsing unavailable |
| Local Git (via simple-git) | Local process | Non-critical | Git integration disabled; direct file management still works |
| Electron Updater | HTTPS | Non-critical | App continues running on current version |

---

## 4. Data Flow

1. **Authentication Gate (startup)**
   - App launches → ai-suggestion-service checks for valid Claude API key or subscription token → if missing or invalid, onboarding screen shown → key stored in OS keychain → app proceeds only after successful validation.

2. **Project Discovery**
   - main-process scans configured workspace directories → config-parser identifies `.claude` folders → ProjectDiscovery groups results (root-level vs project-level) → renderer displays workspace browser.
   - Scan is incremental and watched via filesystem watchers (chokidar).

3. **Skill Graph Rendering**
   - User selects a project → config-parser reads all skill files from `skills/<name>/SKILL.md` → skill-graph-service parses each file's YAML frontmatter (via `gray-matter`) to extract the declared `dependencies` list → dependency edges built from explicit frontmatter declarations (per ADR 0008) → renderer renders interactive graph.

4. **Skill Edit & Orchestrator Sync Flow**
   - User edits a skill file (content change confirmed in UI) → backup-service snapshots the current file → config-parser writes updated content to disk → skill-graph-service re-parses all skill files to find orchestrators that reference the modified skill → ai-suggestion-service calls Claude API with: the modified skill's new content + each referencing orchestrator's current content → Claude API returns updated orchestrator content → backup-service snapshots each orchestrator before overwrite → config-parser writes updated orchestrator files to disk → graph re-renders.

5. **AI Suggestion Flow**
   - On project open or explicit user request → skill-graph-service serializes current skill/rule content → ai-suggestion-service calls Claude API → suggestions shown in sidebar (simplify, merge, remove unused dependency, etc.).

6. **Rule/Hook Creation**
   - User inputs descriptive text → ai-suggestion-service generates file content via Claude API → preview shown in split-view editor → user confirms → backup-service snapshots any existing file at that path → config-parser writes file to disk.

7. **Backup & Rollback Flow**
   - Before every write: backup-service copies current file to `.claude/.backups/<relative-path>/<ISO-timestamp>.md`.
   - User opens history panel for a file → backup-service lists all snapshots sorted by timestamp → user selects a snapshot → backup-service snapshots current file (so rollback is itself reversible) → config-parser replaces current file with selected snapshot → graph/editor re-renders.

8. **Git Integration**
   - On `.claude` folder change → git-service checks if folder is under Git → user optionally commits → git-service stages `.claude` changes and creates a structured commit message.

9. **MCP Management**
   - User browses marketplace → mcp-manager fetches registry → user selects module → mcp-manager installs to `.claude/mcp/` and writes config → compatibility checker validates against current Claude version.

### Data ownership summary

| Entity | Owner component | Storage | PII |
|---|---|---|---|
| Skill, rule, hook, MCP, agent files | config-parser / main-process | Local filesystem (`.claude/`) | No |
| Skill files (`skills/<name>/SKILL.md`) | config-parser / main-process | Local filesystem (`.claude/skills/`) | No |
| Rule files (`rules/<name>.md`) — flat, no subdirectory | main-process | Local filesystem (`.claude/rules/`) | No |
| Global rule files (`~/.claude/rules/<name>.md`) | main-process (read-only) | User home filesystem | No |
| Rule supplement relationship | main-process | Derived from filename stem match (no separate store) | No |
| Hook files (`hooks/<name>/HOOK.md`) | config-parser / main-process | Local filesystem (`.claude/hooks/`) | No |
| MCP config dirs (`mcp/<name>/`) | mcp-manager | Local filesystem (`.claude/mcp/`) | No |
| Backup snapshots | backup-service | Local filesystem (`.claude/.backups/<type>/<name>/<file>/<ts>.md`) | No |
| Skill dependency graph | skill-graph-service | In-memory only (derived from file content) | No |
| Claude API key / subscription token | ai-suggestion-service | OS keychain (keytar) | Yes |
| MCP auth keys | mcp-manager | OS keychain (keytar) | Yes |
| Git history | git-service | Local Git repo | No |

**No database.** No component stores application state outside of `.claude/` folder files and the OS keychain for secrets.

---

## 5. Event Topology

CPM uses in-process IPC events (Electron IPC / Node.js EventEmitter). No external message broker.

| Event | Producer | Consumers | Channel | Notes |
|---|---|---|---|---|
| AuthStateChanged | ai-suggestion-service | renderer, main-process | IPC: `auth:state-changed` | Fired on key validation success/failure |
| ProjectDiscovered | main-process | renderer | IPC: `project:discovered` | Fired per folder on scan completion |
| ConfigChanged | main-process | skill-graph-service, renderer | IPC: `config:changed` | Fired after every file write or external change |
| GraphUpdated | skill-graph-service | renderer | IPC: `graph:updated` | After dependency re-parse |
| OrchestratorSyncStarted | ai-suggestion-service | renderer | IPC: `orchestrator:sync-started` | Before Claude API rewrites orchestrators |
| OrchestratorSyncCompleted | ai-suggestion-service | renderer | IPC: `orchestrator:sync-completed` | After all orchestrator files updated |
| SuggestionReady | ai-suggestion-service | renderer | IPC: `suggestion:ready` | After Claude API suggestion response |
| BackupCreated | backup-service | renderer | IPC: `backup:created` | After each snapshot write, before file write |
| RollbackCompleted | backup-service | renderer, main-process | IPC: `rollback:completed` | After file restored from snapshot |
| GitStatusChanged | git-service | renderer | IPC: `git:status-changed` | On tracked file change (debounced 500ms) |

All IPC channels typed via shared `ipc-channels.ts` contract module.

---

## 6. Cross-Cutting Concerns

### Authentication & Authorisation
- Claude API key or subscription token required for all app functionality. Validated at startup and before every Claude API call.
- Key stored in OS keychain (keytar) — never in config files, `.env`, or logs.
- MCP auth keys stored in OS keychain per entry — never written to `.claude/mcp/` config files in plaintext.
- Single-user desktop app — no multi-user auth required.

### Transport Security
- All outbound HTTPS calls (Claude API, MCP marketplace, updater) use TLS 1.3.
- No inbound network listeners — app exposes no ports.

### Observability
- Structured JSON logs via `electron-log`: `timestamp`, `level`, `component`, `correlation_id`, `message`.
- Correlation IDs used for IPC request/response pairs and multi-step orchestrator sync flows.
- Log sanitisation: strips patterns matching Anthropic API key format before writing.

### Resilience baseline (all outbound HTTP calls)
- Timeout: 30s default; 120s for orchestrator sync stream (large context, streaming); 30s for suggestion requests.
- Retry: exponential backoff + jitter, max 3 attempts on 5xx / network errors. No retry on 401/403 — surface auth error immediately.
- Circuit breaker: persistent error banner after 5 consecutive Claude API failures; prompt user to re-validate API key.
- No offline mode — Claude API is required for core functionality.

### Secrets
- Claude API key: OS keychain only. Never in source, config files, or logs.
- MCP auth keys: OS keychain, per entry.
- Pre-commit hook: warns if API key patterns detected in `.claude` files before Git commit.

---

## 7. Threat Model Outline (STRIDE)

Full threat model required at `docs/threat-model.md` before any public release.

| Threat | Surface | Mitigation |
|---|---|---|
| Spoofing | Claude API calls | API key validated server-side; stored in OS keychain only |
| Tampering | `.claude` config files | Config-parser validates before applying; backup snapshot taken before every write |
| Repudiation | Skill/rule edits | Timestamped backup snapshots + optional Git commit history per change |
| Information Disclosure | Claude API key in logs | Log sanitisation strips key patterns; key never written to disk in plaintext |
| Denial of Service | Claude API overuse | Rate limiting on AI suggestion and orchestrator sync calls; circuit breaker |
| Elevation of Privilege | MCP module install | contextIsolation=true, nodeIntegration=false in renderer; MCP compatibility check before install |
| Supply Chain | npm deps, MCP marketplace | `npm audit` in CI; MCP compatibility checker validates modules before install |

---

## 8. ADR Triggers

- [x] Electron vs Tauri — desktop framework choice: see `docs/adr/0001-desktop-framework-choice.md`
- [x] D3.js vs Cytoscape.js — skill graph rendering library: see `docs/adr/0002-graph-rendering-library.md`
- [x] Monaco vs CodeMirror — embedded code editor choice: see `docs/adr/0003-code-editor-choice.md`
- [x] OS keychain (keytar) vs env-var only — secrets storage strategy: see `docs/adr/0004-secrets-storage-strategy.md`
- [x] Skill dependency parsing strategy — superseded: see `docs/adr/0005-skill-dependency-parsing-strategy.md`
- [x] Skill/rule file format — YAML frontmatter schema for metadata (dependencies, MCP servers, diagrams, triggers): see `docs/adr/0008-skill-rule-file-format.md`
- [x] IPC channel contract strategy — typed `ipc-channels.ts` vs alternative: see `docs/adr/0006-ipc-channel-contract-strategy.md`
- [x] Claude API integration pattern — direct Anthropic SDK call vs local proxy worker for orchestrator sync: see `docs/adr/0007-claude-api-integration-pattern.md`
- [x] Rule inheritance model — project-level supplements identified by filename slug match: see `docs/adr/0009-rule-inheritance-model.md`
- [x] Skill/rule mandatory section structure — numbered steps, bullet constraints, structured body: see `docs/adr/0010-skill-rule-section-structure.md`

---

## 9. Downstream Specs Required

**Service specs** (`/spec-service`):
- [x] docs/architecture/service-main-process.md
- [x] docs/architecture/service-renderer-process.md
- [x] docs/architecture/service-skill-graph-service.md
- [x] docs/architecture/service-ai-suggestion-service.md
- [x] docs/architecture/service-backup-service.md
- [x] docs/architecture/service-mcp-manager.md

**API specs** (`/spec-api`):
- [x] docs/api/ipc-channels-api.md — typed IPC channel contract between renderer and main

**Event contracts** (`/spec-event`):
- [x] docs/events/auth-state-changed-spec.md
- [x] docs/events/config-changed-spec.md
- [x] docs/events/graph-updated-spec.md
- [x] docs/events/orchestrator-sync-completed-spec.md
- [x] docs/events/orchestrator-sync-started-spec.md
- [x] docs/events/suggestion-ready-spec.md
- [x] docs/events/rollback-completed-spec.md
- [x] docs/events/project-discovered-spec.md
- [x] docs/events/backup-created-spec.md
- [x] docs/events/git-status-changed-spec.md

**ADRs** (`/spec-adr`):
- [x] docs/adr/0001-desktop-framework-choice.md
- [x] docs/adr/0002-graph-rendering-library.md
- [x] docs/adr/0003-code-editor-choice.md
- [x] docs/adr/0004-secrets-storage-strategy.md
- [x] docs/adr/0005-skill-dependency-parsing-strategy.md (Superseded by 0008)
- [x] docs/adr/0006-ipc-channel-contract-strategy.md
- [x] docs/adr/0007-claude-api-integration-pattern.md
- [x] docs/adr/0008-skill-rule-file-format.md
- [x] docs/adr/0009-rule-inheritance-model.md
- [x] docs/adr/0010-skill-rule-section-structure.md

**Resilience spec** (`/spec-resilience`):
- [x] docs/architecture/resilience-claude-project-manager.md

**CI/CD & Deployment** (`/spec-cicd`, `/spec-deployment`):
- [x] docs/cicd/claude-project-manager-pipeline.md
- [x] docs/cicd/claude-project-manager-deployment.md

**Diagrams** (`/diagrams`):
- [x] docs/diagrams/claude-project-manager-class.md
- [x] docs/diagrams/claude-project-manager-sequence-scan-workspace.md
- [x] docs/diagrams/claude-project-manager-sequence-edit-skill-and-sync.md
- [x] docs/diagrams/claude-project-manager-sequence-rollback-file.md
- [x] docs/diagrams/claude-project-manager-sequence-install-mcp.md
- [x] docs/diagrams/claude-project-manager-sequence-generate-suggestions.md
- [x] docs/diagrams/claude-project-manager-state-skill-node.md
- [x] docs/diagrams/claude-project-manager-state-mcp-installation.md
- [x] docs/diagrams/claude-project-manager-state-auth-state.md
- [x] docs/diagrams/claude-project-manager-state-orchestrator-update.md
- [x] docs/diagrams/claude-project-manager-state-circuit-breaker.md
- [x] docs/diagrams/claude-project-manager-sequence-validate-api-key.md

**Additional service specs**:
- [x] docs/architecture/service-git-service.md

**Additional API specs**:
- [x] docs/api/mcp-registry-api.md

**Threat model**:
- [x] docs/threat-model.md
