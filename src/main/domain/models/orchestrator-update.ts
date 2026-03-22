export interface OrchestratorUpdate {
  readonly orchestratorPath: string
  readonly oldContent: string
  readonly newContent: string
  readonly isPartial: boolean
}

export function hasDiff(update: OrchestratorUpdate): boolean {
  return update.oldContent !== update.newContent
}
