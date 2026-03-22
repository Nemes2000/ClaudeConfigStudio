# MCP Registry API Specification

**Status:** Draft
**Date:** 2026-03-21
**System:** Claude Project Manager (CPM)
**Consumer:** `mcp-manager` → `MarketplaceClient` → `FetchMarketplaceUseCase`

---

## Overview

The MCP Registry is a read-only REST API that serves the catalogue of available MCP (Model Control Protocol) server modules. `mcp-manager` fetches this catalogue on demand (1h in-memory cache) to populate the marketplace panel in the renderer.

The registry is a public, unauthenticated read endpoint — no user credentials required to browse modules. Auth keys for individual MCP servers are managed separately via the OS keychain.

---

## Base URL

```
https://registry.mcp.anthropic.com/v1
```

> **Note:** This URL is a placeholder. The actual registry host must be confirmed with Anthropic before the `FetchMarketplaceUseCase` is implemented. `MarketplaceClient` must read the base URL from a build-time constant (`MCP_REGISTRY_BASE_URL`) so it can be overridden for testing without a rebuild.

---

## Endpoints

### `GET /modules`

Returns the full catalogue of available MCP modules.

**Request:**
```http
GET /v1/modules
Accept: application/json
User-Agent: claude-project-manager/{version}
```

No authentication required. No query parameters for v1 (full catalogue returned).

**Response — 200 OK:**
```json
{
  "modules": [
    {
      "name": "github",
      "displayName": "GitHub",
      "description": "Browse repositories, issues, and pull requests",
      "version": "1.2.0",
      "author": "Anthropic",
      "repositoryUrl": "https://github.com/anthropics/mcp-github",
      "minClaudeVersion": "0.1.0",
      "authRequired": true,
      "authKeyLabel": "GitHub Personal Access Token",
      "configSchema": {
        "type": "object",
        "properties": {
          "owner": { "type": "string", "description": "GitHub org or user" },
          "defaultBranch": { "type": "string", "default": "main" }
        },
        "required": ["owner"]
      }
    }
  ],
  "generatedAt": "2026-03-21T12:00:00Z",
  "totalCount": 42
}
```

**Response fields:**

| Field | Type | Description |
|---|---|---|
| `modules[].name` | string | Unique slug — matches directory name in `.claude/mcp/<name>/` |
| `modules[].displayName` | string | Human-readable name shown in marketplace UI |
| `modules[].description` | string | One-line description; max 200 chars |
| `modules[].version` | string | Semver of the module |
| `modules[].author` | string | Publisher name |
| `modules[].repositoryUrl` | string | Source code URL |
| `modules[].minClaudeVersion` | string | Minimum Claude agent semver required |
| `modules[].authRequired` | boolean | Whether an auth key is required for this module |
| `modules[].authKeyLabel` | string \| null | Label shown in auth key input (e.g. "GitHub PAT"); null if `authRequired: false` |
| `modules[].configSchema` | JSON Schema object | Validates user-supplied config before install |
| `generatedAt` | string | ISO 8601 timestamp of when registry was last built |
| `totalCount` | number | Total number of modules returned |

**Error responses:**

| Status | Code | When |
|---|---|---|
| 429 | `RATE_LIMITED` | Too many requests from same IP |
| 500 | `REGISTRY_ERROR` | Registry build failed |
| 503 | `SERVICE_UNAVAILABLE` | Registry temporarily down |

---

## Client Behaviour (`MarketplaceClient`)

| Parameter | Value |
|---|---|
| Timeout | 10s (per resilience spec) |
| Retry | 1 retry with 2s fixed delay on 5xx / network error |
| Cache TTL | 60 minutes in-memory |
| Cache key | Single global entry (full module list) |
| Cache invalidation | On explicit user refresh (`mcp:list-marketplace` with `forceRefresh: true`) or app restart |
| Fallback | Return cached list if age < 60 min; otherwise return `{ modules: [], marketplaceUnavailable: true }` |
| No retry on | 429 (surface "rate limited" to renderer) |

---

## `McpModule` TypeScript Interface

This is the domain model populated from the API response:

```typescript
interface McpModule {
  name: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  repositoryUrl: string;
  minClaudeVersion: string;
  authRequired: boolean;
  authKeyLabel: string | null;
  configSchema: JsonSchema;
}
```

All fields map 1:1 to the API response fields. No transformation required except JSON parsing.

---

## Security

- Registry is read-only and unauthenticated — no user credentials transmitted
- `User-Agent` header identifies the CPM version for registry analytics; no PII included
- Registry responses are validated against the `McpModule` schema before use; malformed entries are skipped with a WARN log
- `repositoryUrl` is displayed in the UI but never auto-fetched — user must explicitly open it
- `configSchema` is used only for local validation — never executed as code
