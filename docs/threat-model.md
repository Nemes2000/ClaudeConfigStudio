# Threat Model — Claude Project Manager

**Status:** Draft
**Date:** 2026-03-21
**System:** Claude Project Manager (CPM)
**Framework:** STRIDE
**Review cadence:** Update on every significant architecture or feature change; full review before each major release.

---

## 1. System Overview

CPM is a single-user Electron desktop application. It manages `.claude/` configuration folders on the local filesystem, communicates with the Claude API (Anthropic) for AI features and orchestrator sync, and optionally integrates with local Git and MCP marketplace.

**Trust boundaries:**

```
┌─────────────────────────────────────────────────────┐
│  User's machine (trusted)                           │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  Electron Renderer (untrusted web context)    │  │
│  │  contextIsolation=true, nodeIntegration=false │  │
│  └──────────────┬────────────────────────────────┘  │
│                 │ Electron IPC (preload bridge)       │
│  ┌──────────────▼────────────────────────────────┐  │
│  │  Electron Main Process (trusted Node.js)      │  │
│  │  ├── skill-graph-service                      │  │
│  │  ├── backup-service                           │  │
│  │  ├── mcp-manager                              │  │
│  │  ├── git-service                              │  │
│  │  └── ai-suggestion-service ──────────────────────┼──► Claude API (external)
│  │                                               │  │
│  │  Local filesystem (.claude/ folders)          │  │
│  │  OS keychain (keytar)                         │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Assets to protect:**
1. Claude API key / subscription token
2. MCP server auth keys
3. User's `.claude/` configuration files (skills, rules, hooks, agent profiles)
4. Backup snapshots in `.claude/.backups/`

---

## 2. STRIDE Threat Analysis

### 2.1 Spoofing

| # | Threat | Surface | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| S1 | Attacker injects a fake Claude API response | Claude API HTTPS call | Low | High | TLS 1.3 enforced; Anthropic SDK validates server certificate; no certificate pinning (OS CA store trusted) |
| S2 | Malicious MCP module impersonates a legitimate one | MCP marketplace registry | Medium | Medium | Module `name` slug matched against registry; `repositoryUrl` shown to user before install; user must explicitly confirm install |
| S3 | Renderer-side script attempts to invoke IPC as main process | IPC preload bridge | Low | High | `contextIsolation=true`; `ipcRenderer.invoke` only — no `ipcMain` access from renderer; all file paths validated against workspace roots in main |

### 2.2 Tampering

| # | Threat | Surface | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| T1 | Attacker modifies `.claude/` skill or rule files outside CPM | Local filesystem | Medium | Medium | Backup snapshot taken before every write; `chokidar` detects external changes and emits `config:changed`; user sees diff before accepting external changes |
| T2 | Backup snapshots tampered with to restore malicious content | `.claude/.backups/` | Low | High | Snapshots shown in diff viewer before apply; user must explicitly confirm rollback; no auto-apply |
| T3 | Path traversal via crafted `filePath` IPC payload | `file:read` / `file:write` IPC | Medium | High | All `filePath` values validated against allowed workspace roots in main process before any I/O; `path.resolve` + prefix check |
| T4 | Renderer injects arbitrary content into orchestrator sync prompt | `file:write` IPC payload | Low | Medium | Content length limits enforced (8K tokens for suggestions, 32K for sync); prompt structure is fixed in main process — renderer supplies only file content, not prompt template |

### 2.3 Repudiation

| # | Threat | Surface | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R1 | User denies having modified a skill file | `.claude/` folder edits | Low | Low | Timestamped backup snapshots in `.claude/.backups/` provide per-file change history; optional Git commit history provides a second audit trail |
| R2 | Orchestrator sync rewrites file; user disputes content | Claude API output written to disk | Low | Medium | Pre-write diff shown in `SplitEditorView`; user must confirm before write; pre-write snapshot always created; rollback available |

### 2.4 Information Disclosure

| # | Threat | Surface | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| I1 | Claude API key leaked to log file | Structured logs | Low | Critical | Log sanitisation strips `sk-ant-*` patterns before write; key never held in renderer memory; API key value never in IPC payloads (only `keyPresent: boolean`) |
| I2 | Claude API key leaked in crash dump / memory | Electron process memory | Low | High | Key retrieved from OS keychain at call time; not stored in module-level variables; retrieved value is a local variable scoped to the use case method |
| I3 | Skill/rule file content sent to Anthropic | Claude API prompts | Medium | Medium | User informed in OnboardingWizard that content is sent to Anthropic; pre-send PII scan in `AnthropicClient` detects email addresses, API key patterns, and AWS ARNs; user warned and given option to abort |
| I4 | MCP auth keys exposed in `.claude/mcp/` config files | Filesystem | Low | High | Auth keys never written to JSON config files — stored in OS keychain only; `McpInstallation.hasAuthKey` is a boolean pointer only |
| I5 | Backup snapshot content readable by other local users | `.claude/.backups/` | Low | Medium | Snapshots inherit `.claude/` directory permissions; CPM does not change file permissions; users responsible for OS-level access controls |
| I6 | Path traversal exposes files outside `.claude/` | `file:read` IPC | Medium | High | Mitigated by T3 above; path validation is defence-in-depth for this threat |

### 2.5 Denial of Service

| # | Threat | Surface | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| D1 | Claude API overuse via automated suggestion requests | ai-suggestion-service | Medium | Medium | Rate limiter: max 3 concurrent requests, queue max 100, 5-min timeout; circuit breaker opens after 5 failures; 429 handled with `Retry-After` |
| D2 | Disk full from backup snapshots | `.claude/.backups/` | Medium | Medium | `PruneSnapshotsUseCase` enforces max 50 snapshots per file; backup aborted (not silently skipped) if disk full — surfaced to user |
| D3 | Infinite graph rebuild loop via rapid file writes | `config:changed` handler | Low | Medium | `chokidar` debounce prevents duplicate events; `BuildGraphUseCase` is synchronous and bounded at < 100ms for ≤ 200 files |
| D4 | Memory exhaustion from large skill graphs | `DependencyGraph` in-memory | Low | Low | Graph is rebuilt fresh on each `config:changed`; no persistent accumulation; 200-node practical limit documented |

### 2.6 Elevation of Privilege

| # | Threat | Surface | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| E1 | Renderer-side script gains Node.js / filesystem access | IPC bridge | Low | Critical | `contextIsolation=true`, `nodeIntegration=false`; preload exposes only typed `window.ipc` surface; no `require` or `process` available in renderer |
| E2 | Malicious MCP module executes arbitrary code on install | MCP install flow | Medium | High | MCP modules are config-only — CPM writes JSON config to `.claude/mcp/`; Claude agent (separate process) executes the server; CPM never executes MCP binaries; compatibility check validates `minClaudeVersion` |
| E3 | Crafted `configSchema` in MCP registry executes code | `ValidateCompatibilityUseCase` | Low | High | `configSchema` used only for JSON validation (`ajv`); never executed as code; no `$ref` resolution against external URLs |
| E4 | Skill file body contains executable content injected into Claude prompts | Claude API orchestrator sync | Low | Medium | Prompt construction in main process is fixed-template; skill content is passed as a string literal within the prompt — not interpreted as prompt instructions; Claude API content policy applies |

---

## 3. Mitigations Summary

| Control | Implemented by | Covers |
|---|---|---|
| `contextIsolation=true`, `nodeIntegration=false` | Electron main-process config | E1, S3, T3 |
| Path traversal validation on all `filePath` IPC payloads | main-process IPC handlers | T3, I6 |
| API key in OS keychain only; never in files, logs, or IPC | ai-suggestion-service KeychainStore | I1, I2, I4 |
| Log sanitisation (`sk-ant-*` pattern strip) | electron-log setup | I1 |
| Pre-send PII scan in `AnthropicClient` | ai-suggestion-service | I3 |
| Rate limiter + circuit breaker on Claude API | ai-suggestion-service RateLimiter | D1 |
| Backup-first write (snapshot before every write) | backup-service + main-process WriteFileUseCase | T1, T2, R2 |
| Max 50 snapshots per file + prune on write | backup-service PruneSnapshotsUseCase | D2 |
| TLS 1.3 on all outbound HTTPS | Electron / Node.js http(s) | S1 |
| Secret scanning CI gate (`gitleaks`) | CI pipeline | I1 (source) |
| `npm audit` + `semgrep` + `trivy` in CI | CI pipeline | Supply chain |
| User confirmation before orchestrator sync write | renderer SplitEditorView | R2, T4 |
| MCP config-only install (no binary execution by CPM) | mcp-manager InstallMcpUseCase | E2 |

---

## 4. Out of Scope

- Multi-user or shared-drive scenarios (CPM is single-user)
- Network-level attacks on the user's OS (out of CPM's control)
- Claude API server-side security (Anthropic's responsibility)
- MCP server runtime security (Claude agent's responsibility; CPM only writes config)
- Physical access attacks

---

## 5. Review Triggers

Update this threat model when any of the following occur:
- New external service integration added
- New IPC channel added that accepts a file path or user-supplied string
- New feature that sends user data to a remote endpoint
- MCP module execution model changes (e.g. CPM starts launching MCP binaries)
- Authentication model changes
- Electron major version upgrade (new security primitives may become available)
