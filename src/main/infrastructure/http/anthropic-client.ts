import Anthropic from '@anthropic-ai/sdk'
import log from 'electron-log'
import type { CircuitBreakerState } from '../../domain/models/circuit-breaker'
import type { ICircuitBreaker } from '../../application/commands/generate-suggestions-use-case'
import type { IStreamingAnthropicClient } from '../../application/commands/sync-orchestrator-use-case'

const MODEL = 'claude-sonnet-4-6'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1_000

// ── Circuit Breaker ────────────────────────────────────────────────────────────

export class CircuitBreaker implements ICircuitBreaker {
  private _state: CircuitBreakerState = 'CLOSED'
  private _failureCount = 0
  private _openedAt: number | null = null
  private readonly _failureThreshold = 5
  private readonly _cooldownMs = 60_000
  private _onStateChange?: (state: CircuitBreakerState) => void

  get state(): CircuitBreakerState {
    if (
      this._state === 'OPEN' &&
      this._openedAt !== null &&
      Date.now() - this._openedAt >= this._cooldownMs
    ) {
      this._state = 'HALF_OPEN'
    }
    return this._state
  }

  setOnStateChange(cb: (state: CircuitBreakerState) => void): void {
    this._onStateChange = cb
  }

  check(): void {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker OPEN')
    }
  }

  recordSuccess(): void {
    this._failureCount = 0
    const previous = this._state
    this._state = 'CLOSED'
    this._openedAt = null
    if (previous !== 'CLOSED') this._onStateChange?.('CLOSED')
  }

  recordFailure(): void {
    this._failureCount++
    if (
      this._state === 'HALF_OPEN' ||
      this._failureCount >= this._failureThreshold
    ) {
      this._state = 'OPEN'
      this._openedAt = Date.now()
      this._onStateChange?.('OPEN')
    }
  }
}

// ── Rate Limiter ───────────────────────────────────────────────────────────────

export class RateLimiter {
  private _active = 0
  private readonly _maxConcurrent: number
  private readonly _queue: Array<() => void> = []

  constructor(maxConcurrent = 3) {
    this._maxConcurrent = maxConcurrent
  }

  async acquire(): Promise<void> {
    if (this._active < this._maxConcurrent) {
      this._active++
      return
    }
    return new Promise((resolve) => {
      this._queue.push(() => {
        this._active++
        resolve()
      })
    })
  }

  release(): void {
    this._active--
    const next = this._queue.shift()
    next?.()
  }
}

// ── Anthropic Client ────────────────────────────────────────────────────────────

export class AnthropicApiClient
  implements IStreamingAnthropicClient
{
  private _client: Anthropic | null = null

  private getClient(apiKey: string): Anthropic {
    if (!this._client) {
      this._client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 0 })
    }
    return this._client
  }

  async validateKey(apiKey: string): Promise<boolean> {
    const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 0 })
    try {
      await client.models.list()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('401') || msg.includes('403')) return false
      throw err
    }
  }

  async generateSuggestions(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    timeoutMs: number,
  ): Promise<string> {
    const apiKey = await this.getApiKey()
    const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 0 })

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })
        const block = response.content[0]
        if (block?.type === 'text') return block.text
        return ''
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // No retry on 401/403/429
        if (
          msg.includes('401') ||
          msg.includes('403') ||
          msg.includes('429')
        ) {
          throw err
        }
        if (attempt < MAX_RETRIES - 1) {
          const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 500
          await sleep(backoff)
        } else {
          throw err
        }
      }
    }
    return ''
  }

  async streamOrchestratorSync(
    modifiedSkillContent: string,
    orchestratorContent: string,
    onChunk: (chunk: string) => void,
    timeoutMs: number,
  ): Promise<{ content: string; isPartial: boolean }> {
    const apiKey = await this.getApiKey()
    const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 0 })

    const prompt = buildOrchestratorSyncPrompt(modifiedSkillContent, orchestratorContent)

    let accumulated = ''
    let isPartial = false

    try {
      const stream = await client.messages.stream({
        model: MODEL,
        max_tokens: 32_000,
        messages: [{ role: 'user', content: prompt }],
      })

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          accumulated += event.delta.text
          onChunk(event.delta.text)
        }
      }

      const final = await stream.finalMessage()
      isPartial = final.stop_reason === 'max_tokens'
    } catch (err) {
      log.error({ component: 'anthropic-client', op: 'streamOrchestratorSync', err })
      isPartial = true
    }

    return { content: accumulated, isPartial }
  }

  private async getApiKey(): Promise<string> {
    // API key is loaded from the keychain at call time — never cached in memory
    const { KeytarService } = await import('../keychain/keytar-service')
    const keychain = new KeytarService()
    const key = await keychain.getPassword('claude-project-manager', 'api-key')
    if (!key) throw new Error('AUTH_MISSING')
    return key
  }
}

function buildOrchestratorSyncPrompt(
  modifiedSkillContent: string,
  orchestratorContent: string,
): string {
  return `You are updating an orchestrator skill file to reflect changes made to a dependency skill.

MODIFIED DEPENDENCY SKILL:
${modifiedSkillContent}

ORCHESTRATOR SKILL TO UPDATE:
${orchestratorContent}

Please update the orchestrator skill to accurately reflect the current behaviour and interface of the modified dependency skill. Preserve the orchestrator's existing structure, sections, and style. Return ONLY the updated orchestrator file content.`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
