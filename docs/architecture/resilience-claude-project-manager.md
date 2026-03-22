# Resilience Specification — Claude Project Manager

**Status:** Draft
**Date:** 2026-03-21
**System:** Claude Project Manager (CPM)

---

## 1. Overview

CPM is a desktop application with one critical external dependency (Claude API) and two non-critical ones (MCP marketplace, Electron updater). All local features (file editing, graph visualization, backup, Git integration) must remain fully functional when external services are unavailable. Only AI features (suggestions, orchestrator sync) degrade when the Claude API is unreachable.

---

## 2. Dependency Resilience Matrix

| Dependency | Criticality | Timeout | Retry | Circuit Breaker | Fallback |
|---|---|---|---|---|---|
| Claude API — suggestion calls | Critical for AI features | 30s | 3× exp backoff + jitter | Yes (5 failures → open, 60s cooldown) | Disable suggestions; show banner |
| Claude API — orchestrator sync | Critical for AI features | 120s | No retry (streaming) | Shared with above | Mark sync as partial/failed |
| Claude API — auth validation | Critical for app unlock | 30s | No retry on 401/403; 3× on 5xx | Shared with above | Show OnboardingWizard |
| MCP Marketplace registry | Non-critical | 10s | 1× | No | Return cached list (1h TTL) or empty |
| Electron Updater | Non-critical | 30s | 1× | No | Continue on current version |
| Local Git (simple-git) | Non-critical | 5s | No | No | Disable Git panel; local features unaffected |
| OS Keychain (keytar) | Critical for auth | Sync (< 100ms) | No | No | Surface error; app blocked if key unreadable |

---

## 3. Claude API Circuit Breaker

**Implementation:** `AnthropicClient.circuitBreaker` — state machine per ADR 0007.

| Parameter | Value |
|---|---|
| Failure threshold | 5 consecutive failures |
| Failure triggers | 5xx responses, network timeout, connection refused |
| Non-failure triggers | 401, 403 (auth errors — handled separately), 429 (rate limit — handled separately) |
| Cooldown (OPEN → HALF_OPEN) | 60 seconds |
| Probe timeout (HALF_OPEN) | 30 seconds |
| Recovery | Single successful probe → CLOSED; failure → OPEN (reset cooldown) |

**User impact:**
- CLOSED: full AI features
- OPEN: persistent "Claude API unavailable" banner; retry button; all local features work
- HALF_OPEN: "Retrying…" indicator; local features work

---

## 4. Retry Policy

### Claude API (suggestion calls)
- Max attempts: 3 (initial + 2 retries)
- Backoff: exponential with jitter — `min(base × 2^attempt + rand(0, 1000ms), 30s)`
- Base delay: 1s
- No retry on: 401, 403, 429 (surface immediately)
- 429: respect `Retry-After` header; show countdown in renderer

### MCP Marketplace
- Max attempts: 2 (initial + 1 retry)
- Backoff: fixed 2s delay
- On failure: return in-memory cache if `cacheAgeMs < 3600000`; otherwise return empty list with `marketplaceUnavailable: true` flag

### Electron Updater
- Max attempts: 2
- No user-facing retry UI — silent background check

---

## 5. Timeout Budget

| Operation | Timeout | Where enforced |
|---|---|---|
| Claude API — auth validation | 30s | `AnthropicClient` |
| Claude API — suggestion call | 30s | `AnthropicClient` |
| Claude API — orchestrator sync stream | 120s | `AnthropicClient` (stream total) |
| MCP marketplace fetch | 10s | `MarketplaceClient` |
| Git status / commit | 5s | `git-service` shell call |
| Electron updater check | 30s | Electron Updater default |
| Local FS operations | No explicit timeout (OS-managed) | — |
| OS keychain read | Sync — no timeout | — |

---

## 6. Caching

| Cache | Owner | TTL | Invalidation |
|---|---|---|---|
| MCP marketplace registry | `mcp-manager` in-memory | 60 minutes | On explicit user refresh or app restart |
| AuthState (valid) | `ai-suggestion-service` | Session lifetime | On any 401/403 from Claude API |
| DependencyGraph | `skill-graph-service` in-memory | Until next `config:changed` | Rebuilt on every file change |

No persistent cache files — all caches are in-memory and reset on app restart.

---

## 7. Offline Mode

CPM has **no true offline mode** — Claude API is required for AI features. However, all local features remain fully operational without network:

| Feature | Network required? | Offline behaviour |
|---|---|---|
| Workspace scanning | No | Full functionality |
| Skill/rule/hook editing | No | Full functionality |
| Dependency graph | No | Full functionality |
| Backup and rollback | No | Full functionality |
| Git integration | No (local Git) | Full functionality |
| AI suggestions | Yes | Sidebar shows "Unavailable" |
| Orchestrator sync | Yes | Skipped; file still written |
| MCP marketplace | Yes | Cached list shown or empty |
| Auth validation | Yes | App blocked at startup |

---

## 8. Rate Limiting

| Limit | Value | Enforcement |
|---|---|---|
| Max concurrent Claude API requests | 3 | `RateLimiter` token bucket in `ai-suggestion-service` |
| Request queuing | Yes | Excess requests queued; renderer shows spinner |
| 429 handling | Respect `Retry-After` | No retry until header delay elapses |
| Suggestion requests deduplicated | Yes | If a suggestion request for the same slug is in-flight, the new request waits for the existing one |

---

## 9. Graceful Degradation Summary

| Failure scenario | Degraded behaviour | Recovery |
|---|---|---|
| Claude API unreachable | AI features suspended; circuit opens | Circuit half-opens after 60s; auto-recovery on probe success |
| Claude API 401/403 | OnboardingWizard shown | User re-enters valid API key |
| Claude API 429 | Suggestion delayed by `Retry-After` | Automatic after delay |
| MCP marketplace down | Cached or empty module list | Resolved on next fetch cycle |
| Git not installed | Git panel hidden | Resolved when user installs Git |
| OS keychain failure | App blocked; error dialog | Resolved by user (OS keychain issue) |
| Filesystem permission denied | Error toast; write aborted | Resolved by user (file permissions) |
| Backup disk full | Write aborted (safety-first) | User must free disk space |
