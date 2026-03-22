export interface ClaudeFolderContents {
  readonly skills: readonly string[]
  readonly rules: readonly string[]
  readonly hooks: readonly string[]
  readonly mcps: readonly string[]
  readonly agentConfig: string | null
}

export function isEmptyContents(contents: ClaudeFolderContents): boolean {
  return (
    contents.skills.length === 0 &&
    contents.rules.length === 0 &&
    contents.hooks.length === 0 &&
    contents.mcps.length === 0 &&
    contents.agentConfig === null
  )
}

export interface ClaudeFolder {
  readonly projectPath: string
  readonly claudePath: string
  readonly isRootLevel: boolean
  readonly contents: ClaudeFolderContents
}

export function validateClaudeFolder(folder: ClaudeFolder): void {
  if (!folder.claudePath.startsWith(folder.projectPath)) {
    throw new Error(
      `Invariant violation: claudePath "${folder.claudePath}" must be under projectPath "${folder.projectPath}"`,
    )
  }
}
