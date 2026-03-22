# Sequence Diagram — Install MCP

**Status:** Draft
**Date:** 2026-03-21
**Use case:** User browses MCP marketplace, selects a module, supplies config and optional auth key, and installs it to the current `.claude/` project
**Depends on:** `docs/diagrams/claude-project-manager-class.md`

---

## Specs Read

| Spec | File | Used for |
|---|---|---|
| Class diagram | `docs/diagrams/claude-project-manager-class.md` | McpModule, McpInstallation, CompatibilityResult |
| Service spec (mcp-manager) | `docs/architecture/service-mcp-manager.md` | FetchMarketplaceUseCase, InstallMcpUseCase, ValidateCompatibilityUseCase |
| Service spec (backup-service) | `docs/architecture/service-backup-service.md` | Snapshot before write |
| Service spec (renderer-process) | `docs/architecture/service-renderer-process.md` | MCPManagerView IPC calls |

---

## Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Renderer as Renderer Process<br/>(MCPManagerView)
    participant Main as Main Process
    participant MCPMgr as mcp-manager
    participant Backup as backup-service
    participant Keychain as OS Keychain<br/>(keytar)
    participant Registry as MCP Marketplace<br/>(remote registry)
    participant FS as Filesystem

    %% ── Step 1: Open marketplace ──
    User->>Renderer: Opens MCP Manager panel
    Renderer->>Main: IPC mcp:list-marketplace
    Main->>MCPMgr: FetchMarketplaceUseCase()
    activate MCPMgr

    alt Cache fresh (< 1h old)
        MCPMgr-->>Main: McpModule[] (from memory cache)
    else Cache stale or empty
        MCPMgr->>Registry: GET /registry (HTTPS, TLS 1.3)
        activate Registry
        Registry-->>MCPMgr: McpModule[] (JSON)
        deactivate Registry
        MCPMgr->>MCPMgr: Update in-memory cache with timestamp
        MCPMgr-->>Main: McpModule[]
    end

    deactivate MCPMgr
    Main-->>Renderer: IPC response McpModule[]
    Renderer-->>User: Shows marketplace grid with available modules

    %% ── Step 2: Check compatibility ──
    User->>Renderer: Clicks on McpModule to install
    Renderer->>Main: IPC mcp:validate-compatibility (mcpModule)
    Main->>MCPMgr: ValidateCompatibilityUseCase(mcpModule)
    activate MCPMgr
    MCPMgr->>MCPMgr: Run `claude --version` shell call (no user args)
    MCPMgr->>MCPMgr: Compare detected version with mcpModule.minClaudeVersion
    MCPMgr-->>Main: CompatibilityResult
    deactivate MCPMgr
    Main-->>Renderer: IPC response CompatibilityResult

    alt isCompatible = false
        Renderer-->>User: Shows compatibility warning (install still allowed with confirmation)
        User->>Renderer: Confirms install despite warning
    else isCompatible = true
        note over Renderer: Proceed to config form
    end

    %% ── Step 3: User fills config form ──
    Renderer-->>User: Shows config form (fields from mcpModule.configSchema)
    User->>Renderer: Fills config values + optional auth key
    User->>Renderer: Clicks Install

    Renderer->>Main: IPC mcp:install (mcpModule, configValues, authKey?)
    activate Main

    %% ── Step 4: Validate config ──
    Main->>MCPMgr: InstallMcpUseCase(mcpModule, configValues, authKey?)
    activate MCPMgr
    MCPMgr->>MCPMgr: Validate configValues against mcpModule.configSchema
    alt Validation fails
        MCPMgr-->>Main: ValidationError (field, message)
        Main-->>Renderer: IPC error response
        Renderer-->>User: Shows field-level validation errors
    end

    %% ── Step 5: Write config file (auth key excluded) ──
    MCPMgr->>Backup: SnapshotFileUseCase(.claude/mcp/<name>.json)
    activate Backup
    Backup->>FS: Snapshot existing config (if any)
    Backup-->>MCPMgr: Snapshot (or null if new file)
    deactivate Backup

    MCPMgr->>FS: Write .claude/mcp/<name>.json (config only, no auth key)
    FS-->>MCPMgr: ok

    %% ── Step 6: Store auth key in keychain ──
    alt authKey provided
        MCPMgr->>Keychain: keytar.setPassword("claude-project-manager/mcp/<name>", authKey)
        Keychain-->>MCPMgr: ok
        note over MCPMgr: Auth key stored in OS keychain only — never on disk
    end

    MCPMgr-->>Main: McpInstallation (moduleName, configFilePath, isEnabled=true, hasAuthKey)
    deactivate MCPMgr

    Main-->>Renderer: IPC config:changed (.claude/mcp/<name>.json)
    Main-->>Renderer: IPC mcp:install response (McpInstallation)
    deactivate Main

    Renderer->>Renderer: Update MCPManagerView local list
    Renderer-->>User: Shows installation success; MCP appears in installed list
```

---

## Alt Flows

```mermaid
sequenceDiagram
    autonumber
    participant MCPMgr as mcp-manager
    participant Keychain as OS Keychain
    participant FS as Filesystem

    note over MCPMgr,FS: Alt: Config file write fails
    MCPMgr->>FS: Write .claude/mcp/<name>.json
    FS-->>MCPMgr: Error (permission denied)
    MCPMgr-->>MCPMgr: Do NOT write keychain entry (atomic: both or neither)
    note over MCPMgr: Surface error to renderer; installation rolled back

    note over MCPMgr,Keychain: Alt: Keychain write fails after config write
    MCPMgr->>FS: Config written successfully
    MCPMgr->>Keychain: keytar.setPassword(...)
    Keychain-->>MCPMgr: Error
    note over MCPMgr: Surface error; config file written but hasAuthKey=false
    note over MCPMgr: User can retry SetMcpAuthKeyUseCase separately

    note over MCPMgr: Alt: Registry unavailable
    MCPMgr->>MCPMgr: Network error on registry fetch
    MCPMgr-->>MCPMgr: Return cached McpModule[] if available
    note over MCPMgr: If no cache: return empty list with "marketplace unavailable" flag
```

---

## Notes

- Auth key is NEVER written to `.claude/mcp/<name>.json` — only in OS keychain (`keytar`)
- Config and keychain writes are treated atomically: if config write fails, keychain is not written
- Compatibility warning does not block installation — it is advisory only
- `config:changed` event triggers graph re-parse so `mcp_servers` references in skill frontmatter are updated in the graph view
- Backup is taken before any existing config is overwritten; new installs (no prior config) skip the snapshot
