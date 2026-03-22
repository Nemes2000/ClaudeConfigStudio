# State Diagram — AuthState

**Status:** Draft
**Date:** 2026-03-21
**Entity:** AuthState (ai-suggestion-service domain)
**Depends on:** `docs/diagrams/claude-project-manager-class.md`

---

## Specs Read

| Spec | File | Used for |
|---|---|---|
| Class diagram | `docs/diagrams/claude-project-manager-class.md` | AuthState.isValid, keyPresent, lastValidatedAt, authMethod |
| Service spec (ai-suggestion-service) | `docs/architecture/service-ai-suggestion-service.md` | ValidateApiKeyUseCase, circuit breaker interaction |
| Service spec (renderer-process) | `docs/architecture/service-renderer-process.md` | OnboardingWizard, status bar |

---

## Diagram

```mermaid
stateDiagram-v2
    [*] --> KeyMissing : App startup\nNo API key or session token in keychain\n/ OnboardingWizard shown

    [*] --> Valid : App startup\nClaude account session token found in keychain\n/ AuthState(isValid=true, authMethod=claude-account)\n/ auth:state-changed IPC emitted

    [*] --> Validating : App startup\nAPI key found in keychain\n/ ValidateApiKeyUseCase starts

    KeyMissing --> OAuthPending : User clicks "Sign in with Claude account"\n/ Local callback server starts (127.0.0.1:random)\n/ Browser opens claude.ai/oauth/authorize

    OAuthPending --> Valid : Browser callback received; code exchanged\n/ keytar.setPassword(session-token)\n/ AuthState(isValid=true, authMethod=claude-account)\n/ auth:state-changed IPC emitted

    OAuthPending --> KeyMissing : User cancels / 5-minute timeout\n/ Callback server closed\n/ OnboardingWizard remains

    KeyMissing --> Validating : User submits API key in OnboardingWizard\n/ keytar.setPassword() stores key\n/ ValidateApiKeyUseCase starts

    Validating --> Valid : anthropic.models.list() returns 200\n/ AuthState(isValid=true, authMethod=api-key)\n/ auth:state-changed IPC emitted\n/ App unlocked; scan and suggestions enabled

    Validating --> InvalidKey : anthropic.models.list() returns 401 or 403\n/ AuthState(isValid=false, keyPresent=true)\n/ auth:state-changed IPC emitted\n/ OnboardingWizard shown with error

    Validating --> NetworkError : Network timeout or 5xx after 3 retries\n/ AuthState(isValid=false, keyPresent=true)\n/ auth:state-changed IPC emitted\n/ Status bar shows "Cannot reach Claude API"

    InvalidKey --> Validating : User corrects API key in settings\n/ keytar.setPassword() overwrites old key\n/ ValidateApiKeyUseCase re-runs

    InvalidKey --> KeyMissing : User signs out\n/ keytar.deletePassword() both accounts\n/ OnboardingWizard shown

    NetworkError --> Validating : User clicks "Retry" in status bar\n/ ValidateApiKeyUseCase re-runs

    Valid --> Validating : User rotates API key in settings\n/ keytar.setPassword() with new key\n/ ValidateApiKeyUseCase re-runs

    Valid --> KeyMissing : User signs out\n/ keytar.deletePassword() both accounts\n/ auth:state-changed IPC emitted\n/ OnboardingWizard shown

    Valid --> InvalidKey : Claude API returns 401 on any subsequent call\n/ ValidateApiKeyUseCase triggered immediately\n/ auth:state-changed emitted

    Valid --> NetworkError : Circuit breaker opens (5 consecutive failures)\n/ auth:state-changed with network-error flag\n/ All AI features suspended

    NetworkError --> Valid : Circuit breaker half-open after 60s\n/ Retry probe succeeds (200 OK)\n/ auth:state-changed (isValid=true)\n/ AI features resume
```

---

## State Descriptions

| State | `isValid` | `keyPresent` | `authMethod` | App behaviour |
|---|---|---|---|---|
| `KeyMissing` | false | false | null | OnboardingWizard shown; app blocked |
| `OAuthPending` | false | false | null | Browser opened; spinner shown; waiting for callback |
| `Validating` | false | true | null | Loading spinner in status bar; app partially available |
| `Valid` (API key) | true | true | `'api-key'` | Full app functionality available |
| `Valid` (account) | true | true | `'claude-account'` | Full app functionality available |
| `InvalidKey` | false | true | null | OnboardingWizard shown with error; app blocked |
| `NetworkError` | false | true | null | Status bar warning; local features work; AI features suspended |

---

## Guard Conditions

- `KeyMissing → Validating`: requires non-empty API key string from user
- `KeyMissing → OAuthPending`: user clicked "Sign in with Claude account"; local server must bind successfully
- `OAuthPending → Valid`: callback must include matching `state` (CSRF) and a non-empty `code`
- `Valid → Validating` (key rotation): requires new key string different from stored key
- `NetworkError → Valid` (circuit half-open): probe request must return 200 within 30s timeout

---

## Side Effects

| Transition | Side effect |
|---|---|
| Any → `Valid` | `auth:state-changed` IPC emitted → renderer hides OnboardingWizard, enables sidebar |
| Any → `InvalidKey` | `auth:state-changed` IPC emitted → renderer shows OnboardingWizard with "Invalid key" error |
| Any → `KeyMissing` | `auth:state-changed` IPC emitted → renderer shows OnboardingWizard |
| `KeyMissing → OAuthPending` | Local HTTP server started; `shell.openExternal()` opens browser; 5-minute timeout armed |
| `OAuthPending → KeyMissing` | Local HTTP server closed; timeout cleared |
| `Valid → KeyMissing` (sign-out) | Both keychain entries deleted (`api-key` and `claude-account-session`) |
| `Valid → NetworkError` | Circuit breaker OPEN; all pending Claude API calls fail immediately |
| `NetworkError → Valid` | Circuit breaker CLOSED; queued suggestion/sync requests resume |

---

## Notes

- The API key and session token never appear in `AuthState` — only `keyPresent` and `authMethod` flags
- `ValidateApiKeyUseCase` uses `anthropic.models.list()` as the cheapest possible validation call
- `NetworkError` state does not clear the stored keychain entry — the credential may still be valid once connectivity is restored
- App startup checks for a Claude account session token first; falls back to API key validation if none found
- The OAuth callback server binds to `127.0.0.1` only and accepts exactly one request before shutting down
- `authMethod` is `null` in `InvalidKey` and `NetworkError` states (method unknown until successfully validated)
