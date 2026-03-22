import type { SkillNode } from '../../domain/models/skill-node'
import type { OrchestratorUpdate } from '../../domain/models/orchestrator-update'
import type { ICircuitBreaker, IRateLimiter } from './generate-suggestions-use-case'
import { CircuitOpenError } from '../../domain/exceptions'
import * as fs from 'fs/promises'

export interface IStreamingAnthropicClient {
  streamOrchestratorSync(
    modifiedSkillContent: string,
    orchestratorContent: string,
    onChunk: (chunk: string) => void,
    timeoutMs: number,
  ): Promise<{ content: string; isPartial: boolean }>
}

export interface SyncOrchestratorParams {
  modifiedSkill: SkillNode
  orchestrators: SkillNode[]
  modifiedSkillContent: string
  circuitBreaker: ICircuitBreaker
  rateLimiter: IRateLimiter
  streamingClient: IStreamingAnthropicClient
  onChunk: (orchestratorPath: string, chunk: string) => void
  onStarted: (paths: string[]) => void
  onCompleted: (paths: string[]) => void
}

const SYNC_TIMEOUT_MS = 120_000

export async function syncOrchestrators(
  params: SyncOrchestratorParams,
): Promise<OrchestratorUpdate[]> {
  const {
    orchestrators,
    modifiedSkillContent,
    circuitBreaker,
    rateLimiter,
    streamingClient,
    onChunk,
    onStarted,
    onCompleted,
  } = params

  if (circuitBreaker.state === 'OPEN') {
    throw new CircuitOpenError()
  }

  onStarted(orchestrators.map((o) => o.filePath))
  const results: OrchestratorUpdate[] = []

  // Sequential processing per spec — avoids rate limit spikes
  for (const orchestrator of orchestrators) {
    const oldContent = await fs.readFile(orchestrator.filePath, 'utf-8')

    await rateLimiter.acquire()
    try {
      const { content: newContent, isPartial } =
        await streamingClient.streamOrchestratorSync(
          modifiedSkillContent,
          oldContent,
          (chunk) => onChunk(orchestrator.filePath, chunk),
          SYNC_TIMEOUT_MS,
        )

      if (isPartial) {
        circuitBreaker.recordFailure()
      } else {
        circuitBreaker.recordSuccess()
      }

      results.push({
        orchestratorPath: orchestrator.filePath,
        oldContent,
        newContent,
        isPartial,
      })
    } catch {
      circuitBreaker.recordFailure()
      results.push({
        orchestratorPath: orchestrator.filePath,
        oldContent,
        newContent: oldContent,
        isPartial: true,
      })
    } finally {
      rateLimiter.release()
    }
  }

  onCompleted(results.map((r) => r.orchestratorPath))
  return results
}
