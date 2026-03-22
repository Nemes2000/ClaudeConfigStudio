import * as path from 'path'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import { writeFile } from './write-file-use-case'

export interface CreateRuleSupplementParams {
  claudePath: string
  globalSlug: string
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

export interface CreateRuleSupplementResult {
  filePath: string
  content: string
}

const SUPPLEMENT_SCAFFOLD = (globalSlug: string): string =>
  `---
name: ${globalSlug} (project supplement)
supplements: ${globalSlug}
version: 1.0.0
---

## Additions

1. <!-- Project-specific additions to the global rule -->

## Overrides

1. <!-- Items that override the global rule -->

## Exclusions

- <!-- Global rule items that do NOT apply to this project -->
`

export async function createRuleSupplement(
  params: CreateRuleSupplementParams,
): Promise<CreateRuleSupplementResult> {
  const { claudePath, globalSlug, snapshotRepo, baseDir } = params
  const filePath = path.join(claudePath, 'rules', `${globalSlug}.md`)
  const content = SUPPLEMENT_SCAFFOLD(globalSlug)
  await writeFile({ filePath, content, snapshotRepo, baseDir })
  return { filePath, content }
}
