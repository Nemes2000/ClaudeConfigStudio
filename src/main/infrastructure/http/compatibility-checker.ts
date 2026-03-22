import { execFile } from 'child_process'
import { promisify } from 'util'
import type { McpModule, CompatibilityResult } from '../../domain/models/mcp'
import type { ICompatibilityChecker } from '../../application/commands/mcp-use-cases'

const execFileAsync = promisify(execFile)

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export class ClaudeCompatibilityChecker implements ICompatibilityChecker {
  async check(mcpModule: McpModule): Promise<CompatibilityResult> {
    let detectedClaudeVersion = 'unknown'
    try {
      // claude --version emits no user args — safe from injection
      const { stdout } = await execFileAsync('claude', ['--version'], {
        timeout: 5_000,
      })
      const match = /(\d+\.\d+\.\d+)/.exec(stdout)
      if (match?.[1]) detectedClaudeVersion = match[1]
    } catch {
      return {
        isCompatible: false,
        detectedClaudeVersion: 'not-found',
        requiredMinVersion: mcpModule.minClaudeVersion,
        reason: 'Claude CLI not found or version check failed',
      }
    }

    const isCompatible =
      compareVersions(detectedClaudeVersion, mcpModule.minClaudeVersion) >= 0

    return {
      isCompatible,
      detectedClaudeVersion,
      requiredMinVersion: mcpModule.minClaudeVersion,
      reason: isCompatible
        ? 'Compatible'
        : `Requires Claude ${mcpModule.minClaudeVersion}+, found ${detectedClaudeVersion}`,
    }
  }
}
