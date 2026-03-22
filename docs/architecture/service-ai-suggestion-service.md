# Service Specification — ai-suggestion-service

**Status:** Draft
**Date:** 2026-03-21
**Owner:** TBD
**System:** Claude Project Manager (CPM)
**Stack:** Node.js 20 LTS · TypeScript 5 · @anthropic-ai/sdk · keytar · in-process module

---

## 1. Bounded Context

**Responsibility:** Owns all communication with the Claude API (Anthropic). Provides two capabilities: (1) AI suggestions for open skills/rules shown in the suggestion sidebar, and (2) orchestrator sync — rewriting orchestrator skill files when a dependency skill is modified. Manages API key retrieval from the OS keychain, request rate limiting, circuit breaking, and streaming response delivery to the renderer via IPC.

**Does not own:**
- Which orchestrators need updating (skill-graph-service decides)
- Filesystem writes (main-process WriteFileUseCase)
- UI rendering of suggestions or diff previews (renderer-process)

---

## 2. Responsibilities

- Retrieve and validate the Claude API key / subscription token from the OS keychain at startup and on demand
- Generate AI suggestions for a given skill or rule file (simplify, merge candidates, unused dep warnings, description improvements)
- Execute orchestrator sync: given a modified skill and its content + a list of orchestrator files and their current content, call Claude API to produce updated orchestrator content
- Stream Claude API responses chunk-by-chunk to the renderer via IPC (`suggestion:chunk`, `orchestrator:sync-chunk`)
- Enforce request rate limiting (max N concurrent Claude API calls)
- Implement circuit breaker: disable API calls after 5 consecutive failures, re-enable after 60s
- Surface auth errors immediately to renderer without retry

---

## 3. Hexagonal Layer Boundaries

```
ai-suggestion-service (in-process module)
├── domain/
│   ├── Suggestion          — value object: type, title, description, affectedSlug
│   ├── OrchestratorUpdate  — value object: orchestratorPath, oldContent, newContent
│   └── AuthState           — value object: isValid, keyPresent, lastValidatedAt
├── application/
│   ├── ValidateApiKeyUseCase       — check key from keychain against Claude API
│   ├── GenerateSuggestionsUseCase  — build prompt + call API + parse response
│   └── SyncOrchestratorUseCase     — build prompt + stream API + return updated content
└── infrastructure/
    ├── AnthropicClient     — wraps @anthropic-ai/sdk; handles streaming, retries, circuit breaker
    ├── KeychainStore       — wraps keytar; get/set/delete API key
    └── RateLimiter         — token bucket; max 3 concurrent requests
```

---

## 4. Domain Models

```typescript
type SuggestionType =
  | 'simplify'
  | 'merge-candidate'
  | 'unused-dependency'
  | 'missing-description'
  | 'improve-triggers'
  | 'missing-section';

interface Suggestion {
  type: SuggestionType;
  title: string;
  description: string;
  affectedSlug: string;
  severity: 'info' | 'warning' | 'error';
  affectedSection: string | null; // null for suggestions not targeting a specific section; section name string otherwise
}

interface OrchestratorUpdate {
  orchestratorPath: string;
  oldContent: string;
  newContent: string;         // Claude API output
  isPartial: boolean;         // true if stream was interrupted
}

interface AuthState {
  isValid: boolean;
  keyPresent: boolean;
  lastValidatedAt: Date | null;
}
```

---

## 5. Key Use Cases

### ValidateApiKeyUseCase
- Input: none (reads from OS keychain via `KeychainStore`)
- Action: call `anthropic.models.list()` (cheapest validation call); check for 401/403
- Output: `AuthState`
- Emits: `auth:state-changed` IPC event
- On 401/403: clear circuit breaker, emit auth error, show onboarding wizard in renderer

### GenerateSuggestionsUseCase
- Input: `SkillNode` + file content string
- Action: build structured prompt; call `anthropic.messages.create()` with `claude-sonnet-4-6`; parse JSON response into `Suggestion[]`
- Output: `Suggestion[]`
- Emits: `suggestion:ready` IPC event with full list
- Prompt strategy: single call returning JSON array of suggestions; max 1024 output tokens; suggestions can target specific sections (e.g. type: "improve-instructions", affectedSection: "Instructions"); AI prompt includes section boundaries so Claude can suggest targeted improvements

### SyncOrchestratorUseCase
- Input: modified skill (slug + new content) + list of `{ orchestratorPath, currentContent }` — main-process reads orchestrator file content after receiving `SkillNode[]` from `skill-graph-service.FindOrchestratorsUseCase`; ai-suggestion-service does not read files directly
- Action per orchestrator:
  1. Build prompt: "Here is the updated skill [X]. Here is the orchestrator skill [Y] that references it. Update the orchestrator to reflect the changes in [X]. Preserve all other content."
  2. Stream response via `anthropic.messages.stream()` with `claude-sonnet-4-6`
  3. Forward each chunk via `orchestrator:sync-chunk` IPC event (includes orchestratorPath + chunk text)
  4. On stream complete: assemble full content → return `OrchestratorUpdate`
  5. Caller (main-process) passes `OrchestratorUpdate.newContent` to `WriteFileUseCase`
- Output: `OrchestratorUpdate[]`
- Emits: `orchestrator:sync-started`, `orchestrator:sync-chunk` (per chunk), `orchestrator:sync-completed`
- Orchestrators processed sequentially (not in parallel) to avoid rate limit spikes and allow user to cancel mid-sync
- Note: When rewriting an orchestrator file, the section structure (Purpose, Instructions, Constraints) is preserved — the sync only rewrites the Instructions section content, not the Purpose or Constraints

---

## 6. AnthropicClient

Wraps `@anthropic-ai/sdk`. Implements:

- **Circuit breaker**: state machine (`CLOSED` → `OPEN` after 5 consecutive failures → `HALF_OPEN` after 60s → `CLOSED` on success)
- **Retry**: exponential backoff + jitter, max 3 attempts on 5xx and network errors. No retry on 401/403/429
- **Timeout**: 30s for suggestion calls; 120s for orchestrator sync (large context, streaming)
- **Rate limiter**: max 3 concurrent requests via `RateLimiter` token bucket; queues excess requests

**RateLimiter specification:**

| Parameter | Value |
|---|---|
| Token bucket capacity | 3 tokens |
| Refill | 1 token returned per completed request (success or error) |
| Queue max size | 100 pending requests |
| Queued request timeout | 5 minutes (request dropped with `RATE_LIMITED` error if not started within 5 min) |
| Queue discipline | FIFO |
| Renderer feedback | `SuggestionStore` shows spinner while queued; queue depth logged at DEBUG |

**Circuit breaker HALF_OPEN probe behaviour:**

When the circuit is `HALF_OPEN`, a single probe request is issued to test recovery:
- The probe **bypasses the rate limiter** — it is issued with a priority token that does not consume a regular bucket slot
- No other requests are dispatched while in `HALF_OPEN`; incoming calls queue behind the probe
- If the probe succeeds (HTTP 2xx within 30s): circuit transitions to `CLOSED`; queued requests resume normal rate-limited dispatch
- If the probe fails: circuit returns to `OPEN` and the 60s cooldown resets

```typescript
class AnthropicClient {
  private client: Anthropic;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;

  async createMessage(params: MessageCreateParams): Promise<Message>
  async streamMessage(params: MessageStreamParams): AsyncIterable<MessageStreamEvent>
}
```

---

## 7. IPC Channels Owned

| Channel | Direction | Description |
|---|---|---|
| `auth:validate` | renderer → main → this | Validate API key; return AuthState |
| `auth:state-changed` | this → renderer | Push auth state change |
| `suggestion:request` | renderer → main → this | Request suggestions for open file |
| `suggestion:ready` | this → renderer | Push suggestion list |
| `orchestrator:sync-started` | this → renderer | Notify sync beginning; list of affected orchestrators |
| `orchestrator:sync-chunk` | this → renderer | Stream chunk for a specific orchestrator |
| `orchestrator:sync-completed` | this → renderer | Sync done; all orchestrators updated |

---

## 8. Prompt Design Constraints

- Never include API keys, file system paths outside `.claude/`, or user PII in prompts
- Skill/rule content sent to Claude API is the user's own configuration — user must be informed in onboarding that content is sent to Anthropic
- Max context per suggestion call: 8K tokens (skill content + system prompt)
- Max context per orchestrator sync call: 32K tokens (modified skill + orchestrator content + system prompt)
- Model: `claude-sonnet-4-6` for all calls (cost/quality balance for config assistance tasks)

---

## 9. Dependencies

| Dependency | Type | Purpose |
|---|---|---|
| @anthropic-ai/sdk | npm | Claude API client |
| keytar | npm | OS keychain read/write |
| skill-graph-service | internal | Identifies orchestrators to sync |
| main-process | internal | WriteFileUseCase for persisting sync results |

---

## 10. Security

- API key retrieved from OS keychain at call time — not stored in memory longer than the request
- API key never appears in logs (log sanitisation strips `sk-ant-*` patterns)
- Skill file content sent to Claude API: user consent captured in onboarding; noted in `docs/threat-model.md`
- No user PII sent to Claude API — skill/rule files should not contain PII. Pre-send check in `AnthropicClient` scans content for email addresses, `sk-ant-*` key patterns, and AWS ARN patterns via regex; surfaces a renderer warning and aborts the API call if detected

---

## 11. Observability

- Log every Claude API call at INFO: `{ component: "ai-suggestion-service", useCase, durationMs, inputTokens, outputTokens, model }`
- Log circuit breaker state transitions at WARN
- Log rate limiter queue depth at DEBUG when > 0
- Never log prompt content or response content (may contain user config data)

---

## 12. Error Handling

- 401/403: emit `auth:state-changed` with `isValid: false`; do not retry; show onboarding wizard
- 429: respect `retry-after` header; surface "rate limited" banner in renderer
- 5xx / network error: retry up to 3× with backoff; after 5 consecutive failures open circuit breaker
- Stream interrupted mid-sync: mark `OrchestratorUpdate.isPartial = true`; renderer shows partial diff with warning; user can retry or cancel
- Circuit open: all API calls immediately return error; renderer shows persistent "Claude API unavailable" banner with retry button
