import type { SuggestionType, SuggestionSeverity } from './skill-node'

export interface Suggestion {
  readonly type: SuggestionType
  readonly title: string
  readonly description: string
  readonly affectedSlug: string
  readonly severity: SuggestionSeverity
  readonly affectedSection: string
}
