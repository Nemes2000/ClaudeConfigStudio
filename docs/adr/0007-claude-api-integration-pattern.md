# 0007 — Call the Anthropic SDK directly from the main process ai-suggestion-service

**Status:** Proposed

**Date:** 2026-03-21

## Context

CPM requires Claude API calls for two purposes: (1) AI suggestions and linting shown in the sidebar, and (2) orchestrator skill file rewriting when a dependency skill is modified. Both require access to the user's API key stored in the OS keychain. The integration pattern determines where the SDK runs, how the API key is accessed, and how streaming responses (for long orchestrator rewrites) are delivered to the renderer.

## Decision

We will call the Anthropic Node.js SDK (`@anthropic-ai/sdk`) directly from the main process inside the `ai-suggestion-service` module. The API key is retrieved from the OS keychain at call time. Streaming responses are forwarded to the renderer via IPC events (`suggestion:chunk`, `orchestrator:sync-chunk`) so the UI can show progressive output. No proxy server, sidecar process, or separate worker thread is used.

## Alternatives Considered

### Local HTTP proxy worker (separate Node.js process)
Running a local HTTP server as a sidecar that proxies Claude API requests would allow the renderer to call it directly via `fetch`, matching web development patterns. However, it adds process management complexity (spawn, health-check, port management), a local attack surface (any process on the machine could call the proxy), and requires IPC anyway to pass the API key securely from the main process. The benefit (web-style fetch in renderer) is not worth the cost.

### Worker thread (`worker_threads`) in the main process
Offloading Claude API calls to a worker thread avoids blocking the main process event loop during long orchestrator rewrites. In practice, `@anthropic-ai/sdk` uses async streaming — it does not block the event loop. A worker thread adds serialization overhead and complicates API key access. The direct async call pattern with streaming IPC forwarding achieves the same non-blocking goal more simply.

### Calling the SDK from the renderer process via preload bridge
Exposing the Anthropic SDK to the renderer would violate the `contextIsolation=true` security model and require `nodeIntegration=true`. It would also expose the API key to the renderer process, which has a larger XSS attack surface. Rejected on security grounds.

## Consequences

**Positive:**
- Simple, direct call path: `ai-suggestion-service` → `@anthropic-ai/sdk` → Claude API
- API key retrieved from OS keychain in the main process — never crosses to the renderer
- Streaming responses forwarded chunk-by-chunk via IPC for progressive UI updates
- No additional processes or ports to manage

**Negative / trade-offs:**
- Long orchestrator rewrites (multiple large skill files) run in the main process event loop; must use async streaming correctly to avoid stalling IPC handling for other events
- If the Anthropic SDK or its HTTP client blocks unexpectedly, it affects the entire main process; monitoring and circuit breaker logic must be implemented in `ai-suggestion-service`
- Rate limiting and retry logic must be implemented in `ai-suggestion-service` (not provided out of the box by the SDK for all error types)

**Neutral:**
- `ai-suggestion-service` is the only module that imports `@anthropic-ai/sdk` — API key access is centralised
- Both suggestion calls (low latency, small context) and orchestrator sync calls (higher latency, large context) share the same service; request prioritisation may be needed if both are triggered simultaneously

---

*Status lifecycle: `Proposed` → `Accepted` → `Deprecated`. Once Accepted, this record is immutable. To reverse or change the decision, create a new ADR that supersedes this one.*
