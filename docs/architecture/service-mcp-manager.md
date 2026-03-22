# Service Specification — mcp-manager

**Status:** Draft
**Date:** 2026-03-21
**Owner:** TBD
**System:** Claude Project Manager (CPM)
**Stack:** Node.js 20 LTS · TypeScript 5 · keytar · node-fetch · in-process module

---

## 1. Bounded Context

**Responsibility:** Owns all MCP (Model Control Protocol) server management for a `.claude/` project. Provides MCP marketplace browsing (remote registry), local MCP installation, enable/disable toggling, authentication key management via OS keychain, and compatibility validation against the current Claude agent version. All MCP config is stored as files in `.claude/mcp/` — no database.

**Does not own:**
- MCP server runtime execution (Claude agent handles that)
- UI for the MCP marketplace panel (renderer-process)
- Secrets storage mechanism (keytar — but mcp-manager is the only caller for MCP keys)

---

## 2. Responsibilities

- Fetch and cache the MCP marketplace registry from a remote registry URL
- Install an MCP module: write config file to `.claude/mcp/<name>.json`
- Uninstall an MCP module: remove config file; delete associated keychain entries
- Enable / disable an MCP: toggle `enabled` field in config file
- Manage auth keys: store per-MCP API keys in OS keychain under `claude-project-manager/mcp/<name>`; never write auth keys to `.claude/mcp/` config files
- Validate compatibility: check MCP module's declared `minClaudeVersion` against detected Claude agent version
- List installed MCPs for a `.claude/` project with status (enabled, disabled, auth-required, incompatible)

---

## 3. Hexagonal Layer Boundaries

```
mcp-manager (in-process module)
├── domain/
│   ├── McpModule           — entity: name, description, version, configSchema, minClaudeVersion, authRequired
│   ├── McpInstallation     — entity: moduleName, configFilePath, isEnabled, hasAuthKey
│   └── CompatibilityResult — value object: isCompatible, reason
├── application/
│   ├── FetchMarketplaceUseCase    — fetch remote registry; return McpModule[]
│   ├── InstallMcpUseCase          — write config file; store auth key if required
│   ├── UninstallMcpUseCase        — remove config file; delete keychain entry
│   ├── ToggleMcpUseCase           — enable/disable in config file
│   ├── SetMcpAuthKeyUseCase       — store/update key in OS keychain
│   └── ValidateCompatibilityUseCase — compare minClaudeVersion with detected version
└── infrastructure/
    ├── MarketplaceClient   — HTTP fetch from remote registry; caches response for 1h
    ├── McpConfigStore      — fs.promises wrappers for .claude/mcp/ files
    └── McpKeychainStore    — keytar wrappers for per-MCP auth keys
```

---

## 4. Domain Models

```typescript
interface McpModule {
  name: string;               // unique slug (e.g. "filesystem", "github")
  displayName: string;
  description: string;
  version: string;            // semver
  author: string;
  repositoryUrl: string;
  configSchema: JsonSchema;   // JSON Schema for config file fields
  minClaudeVersion: string;   // semver minimum Claude agent version
  authRequired: boolean;      // true if an API key is needed
  authKeyLabel: string;       // display label for the key input (e.g. "GitHub Token")
}

interface McpInstallation {
  moduleName: string;
  configFilePath: string;     // absolute path: .claude/mcp/<name>.json
  isEnabled: boolean;
  hasAuthKey: boolean;        // true if OS keychain has a key for this MCP
  config: Record<string, unknown>; // parsed config fields (never includes auth key)
}

interface CompatibilityResult {
  isCompatible: boolean;
  detectedClaudeVersion: string | null;
  requiredMinVersion: string;
  reason: string;
}
```

---

## 5. MCP Config File Format

Each installed MCP is stored as a JSON file at `.claude/mcp/<name>.json`:

```json
{
  "name": "github",
  "version": "1.2.0",
  "enabled": true,
  "config": {
    "owner": "my-org",
    "defaultBranch": "main"
  }
}
```

Auth keys are **never** included in this file. The `config` object contains only non-secret configuration fields as defined by the module's `configSchema`.

---

## 6. Key Use Cases

### FetchMarketplaceUseCase
- Input: none
- Action: GET remote registry URL (see note below); parse `McpModule[]`; cache in memory for 1 hour
- Timeout: 10s (per resilience spec `MarketplaceClient` timeout budget)
- Retry: 1 retry with 2s fixed delay; on failure return cached list if `cacheAgeMs < 3600000`, otherwise empty list with `marketplaceUnavailable: true`
- Output: `McpModule[]`
- Fallback: if network unavailable, return cached result or empty list with "marketplace unavailable" flag

> **Registry URL — deferred:** The MCP marketplace registry endpoint, authentication scheme, and response schema are not defined in this spec. They require a separate `docs/api/mcp-registry-api.md` spec to be written before `FetchMarketplaceUseCase` can be implemented. Until then, `MarketplaceClient` returns a hardcoded stub list for development. The `mcp:list-marketplace` IPC channel works end-to-end; only the remote fetch is stubbed.

### InstallMcpUseCase
- Input: `McpModule` + user-supplied config values + optional auth key
- Action:
  1. Validate config values against `McpModule.configSchema`
  2. Call `ValidateCompatibilityUseCase`; warn (not block) if incompatible
  3. Write config file to `.claude/mcp/<name>.json`
  4. If auth key provided: store in OS keychain via `McpKeychainStore`
  5. Emit `config:changed` event so graph re-parses `mcp_servers` references
- Output: `McpInstallation`

### UninstallMcpUseCase
- Input: `moduleName`
- Action:
  1. Snapshot config file via backup-service
  2. Delete `.claude/mcp/<name>.json`
  3. Delete keychain entry for this MCP
- Output: void; emits `config:changed`

### ToggleMcpUseCase
- Input: `moduleName` + `enabled: boolean`
- Action: snapshot config file → update `enabled` field in JSON → write back
- Output: updated `McpInstallation`

### SetMcpAuthKeyUseCase
- Input: `moduleName` + `authKey: string`
- Action: store in OS keychain under `claude-project-manager/mcp/<moduleName>`; update `McpInstallation.hasAuthKey`
- Output: void
- Auth key is never written to disk; never logged

### ValidateCompatibilityUseCase
- Input: `McpModule`
- Action: detect Claude agent version from PATH (`claude --version` shell call); compare with `McpModule.minClaudeVersion`
- Output: `CompatibilityResult`
- If Claude agent not found: `isCompatible: false`, reason: "Claude agent not found in PATH"

---

## 7. IPC Channels Served

| Channel | Caller | Response |
|---|---|---|
| `mcp:list-marketplace` | renderer | `McpModule[]` from registry |
| `mcp:list-local` | renderer | `McpInstallation[]` for current project |
| `mcp:install` | renderer | `McpInstallation` |
| `mcp:uninstall` | renderer | void |
| `mcp:toggle` | renderer | updated `McpInstallation` |
| `mcp:set-auth-key` | renderer | void |
| `mcp:validate-compatibility` | renderer | `CompatibilityResult` |

---

## 8. Dependencies

| Dependency | Type | Purpose |
|---|---|---|
| keytar | npm | Per-MCP auth key storage in OS keychain |
| node-fetch / undici | npm | Marketplace registry HTTP fetch |
| backup-service | internal | Snapshot config files before modify/delete |
| main-process | internal | `config:changed` event emission |

---

## 9. Security

- Auth keys stored exclusively in OS keychain — never written to `.claude/mcp/` config files
- Auth keys never logged (McpKeychainStore sanitises log output)
- Marketplace registry fetched over HTTPS only; TLS certificate validated
- MCP config files validated against `configSchema` before write — no arbitrary JSON injection
- `ValidateCompatibilityUseCase` uses `claude --version` shell call with no user-supplied arguments (no command injection)

---

## 10. Observability

- Log every install/uninstall/toggle at INFO: `{ component: "mcp-manager", action, moduleName }`
- Log marketplace fetch at DEBUG: `{ durationMs, moduleCount, fromCache }`
- Log compatibility check at INFO: `{ moduleName, isCompatible, detectedVersion, requiredVersion }`
- Never log auth key values

---

## 11. Error Handling

- Marketplace fetch failure: return cached result (if available) with `{ fromCache: true, cacheAgeMs }`; if no cache, return empty list with error flag
- Config file write failure: surface error to renderer; do not update keychain entry if write failed
- Keychain write failure: surface error; do not write config file (keep operations atomic: both succeed or neither)
- Schema validation failure: return typed validation error to renderer; do not write file
- Claude agent not in PATH: `CompatibilityResult.isCompatible = false` with explanation; installation still allowed with user warning
