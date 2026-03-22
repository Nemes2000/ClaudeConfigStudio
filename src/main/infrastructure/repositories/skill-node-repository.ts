import * as fs from 'fs/promises'
import * as path from 'path'
import matter from 'gray-matter'
import type { ISkillNodeRepository } from '../../application/services/i-skill-node-repository'
import type { SkillNode } from '../../domain/models/skill-node'
import { atomicWrite } from '../fs/atomic-write'
import { extractSectionHeadings } from '../../application/queries/validate-skill-structure-use-case'

export class SkillNodeRepository implements ISkillNodeRepository {
  async findBySlug(slug: string, claudePath: string): Promise<SkillNode | null> {
    const filePath = path.join(claudePath, 'skills', slug, 'SKILL.md')
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return this.parse(filePath, slug, content)
    } catch {
      return null
    }
  }

  async findAll(claudePath: string): Promise<SkillNode[]> {
    const skillsDir = path.join(claudePath, 'skills')
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true })
      const nodes: SkillNode[] = []
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const filePath = path.join(skillsDir, entry.name, 'SKILL.md')
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          nodes.push(this.parse(filePath, entry.name, content))
        } catch {
          // Skip missing SKILL.md
        }
      }
      return nodes
    } catch {
      return []
    }
  }

  async save(node: SkillNode): Promise<void> {
    const content = await fs.readFile(node.filePath, 'utf-8')
    const parsed = matter(content)
    parsed.data['enabled'] = node.isEnabled ? undefined : false
    if (!node.isEnabled) {
      parsed.data['enabled'] = false
    } else {
      delete parsed.data['enabled']
    }
    const newContent = matter.stringify(parsed.content, parsed.data)
    await atomicWrite(node.filePath, newContent)
  }

  async toggle(slug: string, claudePath: string, enabled: boolean): Promise<SkillNode> {
    const node = await this.findBySlug(slug, claudePath)
    if (!node) throw new Error(`Skill "${slug}" not found`)
    const updated: SkillNode = { ...node, isEnabled: enabled }
    await this.save(updated)
    return updated
  }

  private parse(filePath: string, slug: string, content: string): SkillNode {
    if (!content.includes('---')) {
      return {
        slug,
        name: slug,
        description: '',
        version: '',
        filePath,
        isEnabled: true,
        dependencies: [],
        mcpServers: [],
        diagrams: [],
        triggers: [],
        isMissingFrontmatter: true,
        hasPurposeSection: false,
        hasInstructionsSection: false,
      }
    }
    const parsed = matter(content)
    const data = parsed.data as Record<string, unknown>
    const headings = extractSectionHeadings(content)
    return {
      slug,
      name: String(data['name'] ?? slug),
      description: String(data['description'] ?? ''),
      version: String(data['version'] ?? ''),
      filePath,
      isEnabled: data['enabled'] !== false,
      dependencies: toStringArray(data['dependencies']),
      mcpServers: toStringArray(data['mcp_servers']),
      diagrams: toStringArray(data['diagrams']),
      triggers: toStringArray(data['triggers']),
      isMissingFrontmatter: false,
      hasPurposeSection: headings.includes('Purpose'),
      hasInstructionsSection: headings.includes('Instructions'),
    }
  }
}

function toStringArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String)
  return []
}
