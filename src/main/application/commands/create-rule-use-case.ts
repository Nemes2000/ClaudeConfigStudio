import * as path from 'path'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import { writeFile } from './write-file-use-case'

export interface CreateRuleParams {
  claudePath: string
  slug: string
  name: string
  description: string
  paths?: string
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

export interface CreateRuleResult {
  filePath: string
  content: string
}

const RULE_SCAFFOLD = (
  name: string,
  description: string,
  paths?: string,
): string => {
  const frontmatter: Record<string, unknown> = {
    name,
    description,
    version: '1.0.0',
  }
  if (paths) frontmatter['paths'] = paths

  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  return `---\n${fm}\n---\n\n## Purpose\n\n<!-- Describe what this rule covers -->\n\n## Rules\n\n1. <!-- Rule item -->\n`
}

export async function createRule(
  params: CreateRuleParams,
): Promise<CreateRuleResult> {
  const { claudePath, slug, name, description, paths, snapshotRepo, baseDir } =
    params
  const filePath = path.join(claudePath, 'rules', `${slug}.md`)
  const content = RULE_SCAFFOLD(name, description, paths)
  await writeFile({ filePath, content, snapshotRepo, baseDir })
  return { filePath, content }
}
