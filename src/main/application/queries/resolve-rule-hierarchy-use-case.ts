import * as fs from 'fs/promises'
import * as path from 'path'
import matter from 'gray-matter'
import type { RuleHierarchy } from '../../domain/models/rule-hierarchy'
import { homedir } from 'os'

export interface ResolveRuleHierarchyParams {
  claudePath: string
}

/**
 * Reads all rules from ~/.claude/rules/ and matches them against
 * any project-level supplement in <claudePath>/rules/.
 */
export async function resolveRuleHierarchy(
  params: ResolveRuleHierarchyParams,
): Promise<RuleHierarchy[]> {
  const { claudePath } = params
  const globalRulesDir = path.join(homedir(), '.claude', 'rules')
  const projectRulesDir = path.join(claudePath, 'rules')

  const globalFiles = await listMdFiles(globalRulesDir)
  const projectFiles = await listMdFiles(projectRulesDir)

  const projectBySlug = new Map<string, string>()
  for (const filePath of projectFiles) {
    const slug = path.basename(filePath, '.md')
    projectBySlug.set(slug, filePath)
  }

  const result: RuleHierarchy[] = []
  for (const globalPath of globalFiles) {
    const slug = path.basename(globalPath, '.md')
    const isGlobalEnabled = await isFileEnabled(globalPath)
    const supplementPath = projectBySlug.get(slug) ?? null
    const isSupplementEnabled =
      supplementPath !== null ? await isFileEnabled(supplementPath) : null

    result.push({
      slug,
      globalPath,
      supplementPath,
      isGlobalEnabled,
      isSupplementEnabled,
    })
  }

  return result
}

async function listMdFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => path.join(dir, e.name))
  } catch {
    return []
  }
}

async function isFileEnabled(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(content)
    return parsed.data['enabled'] !== false
  } catch {
    return true
  }
}
