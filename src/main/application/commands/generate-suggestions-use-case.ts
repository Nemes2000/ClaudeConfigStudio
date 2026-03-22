import type { SkillNode } from '../../domain/models/skill-node'
import type { Suggestion } from '../../domain/models/suggestion'
import type { IAnthropicClient } from './validate-api-key-use-case'
import { CircuitOpenError } from '../../domain/exceptions'

export interface ICircuitBreaker {
  readonly state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  check(): void
  recordSuccess(): void
  recordFailure(): void
}

export interface IRateLimiter {
  acquire(): Promise<void>
  release(): void
}

export interface ISuggestionsAnthropicClient extends IAnthropicClient {
  generateSuggestions(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    timeoutMs: number,
  ): Promise<string>
}

export interface GenerateSuggestionsParams {
  skillNode: SkillNode
  fileContent: string
  circuitBreaker: ICircuitBreaker
  rateLimiter: IRateLimiter
  anthropicClient: ISuggestionsAnthropicClient
}

const MAX_INPUT_TOKENS = 8_000
const MAX_OUTPUT_TOKENS = 1_024
const TIMEOUT_MS = 30_000

/** Truncates content to approximately maxTokens worth of characters (1 token ≈ 4 chars) */
function truncateContent(content: string): string {
  const maxChars = MAX_INPUT_TOKENS * 4
  if (content.length <= maxChars) return content
  return content.slice(0, maxChars) + '\n\n[Content truncated]'
}

export async function generateSuggestions(
  params: GenerateSuggestionsParams,
): Promise<Suggestion[]> {
  const { skillNode, fileContent, circuitBreaker, rateLimiter, anthropicClient } = params

  if (circuitBreaker.state === 'OPEN') {
    throw new CircuitOpenError()
  }

  await rateLimiter.acquire()

  try {
    circuitBreaker.check()

    const truncatedContent = truncateContent(fileContent)
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(skillNode, truncatedContent)

    const raw = await anthropicClient.generateSuggestions(
      systemPrompt,
      userPrompt,
      MAX_OUTPUT_TOKENS,
      TIMEOUT_MS,
    )

    let suggestions: Suggestion[] = []
    try {
      suggestions = JSON.parse(raw) as Suggestion[]
    } catch {
      // Malformed JSON — return empty (silent degradation)
      circuitBreaker.recordFailure()
      return []
    }

    circuitBreaker.recordSuccess()
    return suggestions
  } finally {
    rateLimiter.release()
  }
}

function buildSystemPrompt(): string {
  return `You are an assistant that analyzes Claude Code skill files and suggests improvements.
Respond ONLY with a JSON array of suggestion objects. Each object must have:
- type: one of "simplify"|"merge-candidate"|"unused-dependency"|"missing-description"|"improve-triggers"|"missing-section"
- title: short title (max 60 chars)
- description: actionable description (max 200 chars)
- affectedSlug: the skill slug
- severity: one of "info"|"warning"|"error"
- affectedSection: the ## section heading the suggestion relates to`
}

function buildUserPrompt(node: SkillNode, content: string): string {
  return `Skill slug: ${node.slug}
Name: ${node.name}
Dependencies: ${node.dependencies.join(', ') || 'none'}

Content:
${content}`
}
