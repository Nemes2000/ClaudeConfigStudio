# Sequence Diagram — Generate Suggestions

**Status:** Draft
**Date:** 2026-03-21
**Use case:** User opens a skill file (or the suggestion sidebar refreshes automatically) → CPM sends skill content to Claude API → suggestions rendered in sidebar
**Depends on:** `docs/diagrams/claude-project-manager-class.md`

---

## Specs Read

| Spec | File | Used for |
|---|---|---|
| Class diagram | `docs/diagrams/claude-project-manager-class.md` | SkillNode, Suggestion, AuthState, SuggestionType |
| Service spec (ai-suggestion-service) | `docs/architecture/service-ai-suggestion-service.md` | GenerateSuggestionsUseCase, ValidateApiKeyUseCase |
| Service spec (renderer-process) | `docs/architecture/service-renderer-process.md` | SuggestionSidebar, SuggestionStore |

---

## Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Renderer as Renderer Process<br/>(SuggestionSidebar)
    participant Main as Main Process
    participant AISvc as ai-suggestion-service
    participant Keychain as OS Keychain<br/>(keytar)
    participant Claude as Claude API<br/>(Anthropic)

    %% ── Step 1: Auth gate (app startup or on-demand) ──
    note over AISvc,Keychain: Auth gate runs at startup; cached for session
    AISvc->>Keychain: keytar.getPassword("claude-project-manager", "anthropic-api-key")
    Keychain-->>AISvc: apiKey (or null)

    alt apiKey is null or empty
        AISvc-->>Main: AuthState (isValid=false, keyPresent=false)
        Main-->>Renderer: IPC auth:state-changed (isValid=false)
        Renderer-->>User: OnboardingWizard shown — enter API key
        note over Renderer: Flow blocked until valid key provided
    else apiKey present
        AISvc->>Claude: anthropic.models.list() — validation call, timeout 30s
        activate Claude
        alt 401 / 403
            Claude-->>AISvc: Unauthorized
            deactivate Claude
            AISvc-->>Main: AuthState (isValid=false, keyPresent=true)
            Main-->>Renderer: IPC auth:state-changed
            Renderer-->>User: "Invalid API key" error in status bar
        else 200 OK
            Claude-->>AISvc: Models list
            deactivate Claude
            AISvc-->>Main: AuthState (isValid=true, keyPresent=true)
            Main-->>Renderer: IPC auth:state-changed (isValid=true)
        end
    end

    %% ── Step 2: User opens a skill file ──
    User->>Renderer: Clicks skill node in graph / opens file in editor
    Renderer->>Main: IPC file:read (filePath)
    Main-->>Renderer: IPC response (fileContent)
    Renderer->>Renderer: EditorStore.setContent(fileContent)
    Renderer-->>User: Monaco editor shows skill content

    %% ── Step 3: Request suggestions ──
    Renderer->>Main: IPC suggestion:request (skillNode, fileContent)
    activate Main
    Main->>AISvc: GenerateSuggestionsUseCase(skillNode, fileContent)
    activate AISvc

    %% ── Step 4: Rate limiter check ──
    AISvc->>AISvc: RateLimiter.acquire() — max 3 concurrent requests
    note over AISvc: If limit reached, request queued; Renderer shows loading spinner

    %% ── Step 5: Circuit breaker check ──
    AISvc->>AISvc: CircuitBreaker.check()
    alt Circuit OPEN
        AISvc-->>Main: Error (circuit open — Claude API unavailable)
        Main-->>Renderer: IPC error response
        Renderer-->>User: "Suggestions unavailable — Claude API unreachable" in sidebar
    else Circuit CLOSED or HALF_OPEN
        %% ── Step 6: Build prompt and call Claude API ──
        AISvc->>AISvc: Build structured prompt (skillNode metadata + fileContent, max 8K tokens)
        AISvc->>Claude: anthropic.messages.create() — claude-sonnet-4-6, max 1024 output tokens, timeout 30s
        activate Claude

        alt 5xx / network error (up to 3 retries with backoff)
            Claude-->>AISvc: Error
            AISvc->>AISvc: Retry with exponential backoff + jitter
            AISvc->>Claude: Retry request
        end

        Claude-->>AISvc: Message (JSON array of suggestions)
        deactivate Claude

        AISvc->>AISvc: Parse JSON → Suggestion[]
        AISvc->>AISvc: CircuitBreaker.recordSuccess()
        AISvc->>AISvc: RateLimiter.release()
        AISvc-->>Main: Suggestion[]
        deactivate AISvc

        Main-->>Renderer: IPC suggestion:ready (Suggestion[])
        deactivate Main

        Renderer->>Renderer: SuggestionStore.setSuggestions(suggestions)
        Renderer-->>User: Sidebar shows suggestion cards (simplify, merge-candidate, unused-dep, etc.)
    end
```

---

## Alt Flows

```mermaid
sequenceDiagram
    autonumber
    participant AISvc as ai-suggestion-service
    participant Claude as Claude API

    note over AISvc,Claude: Alt: 429 Rate Limited
    Claude-->>AISvc: 429 Too Many Requests (retry-after: 30s)
    AISvc->>AISvc: Do NOT retry — respect retry-after
    AISvc-->>AISvc: Surface "rate limited" flag to renderer
    note over AISvc: Renderer shows "Rate limited — suggestions available in Xs"

    note over AISvc,Claude: Alt: Malformed JSON response
    Claude-->>AISvc: 200 OK but non-JSON body
    AISvc->>AISvc: Parse error → return empty Suggestion[]
    AISvc->>AISvc: CircuitBreaker.recordFailure()
    note over AISvc: Renderer shows empty sidebar; no error toast (silent degradation)
```

---

## Notes

- Auth validation runs once at startup and is cached for the session; `AuthState` is re-validated only on explicit user action or 401 from a subsequent API call
- Suggestion calls are non-blocking: the editor and graph remain fully interactive while suggestions load
- Skill content sent to Claude API must not contain PII — ai-suggestion-service performs a pre-send check (per security spec)
- User is informed in onboarding that skill content is sent to Anthropic for AI assistance
- Timeout: 30s for suggestion calls; after timeout circuit breaker records a failure
- Max 8K tokens input (skill content + system prompt); oversized files are truncated with a warning
