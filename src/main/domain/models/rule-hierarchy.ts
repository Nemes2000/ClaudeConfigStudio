export interface RuleHierarchy {
  readonly slug: string
  readonly globalPath: string
  readonly supplementPath: string | null
  readonly isGlobalEnabled: boolean
  readonly isSupplementEnabled: boolean | null
}

export function hasSupplement(rule: RuleHierarchy): boolean {
  return rule.supplementPath !== null
}

export function isFullyDisabled(rule: RuleHierarchy): boolean {
  if (!rule.isGlobalEnabled) return true
  if (rule.isSupplementEnabled === false) return true
  return false
}
