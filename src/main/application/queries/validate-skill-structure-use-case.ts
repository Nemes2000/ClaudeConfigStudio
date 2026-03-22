import * as fs from 'fs/promises'
import * as path from 'path'

export interface ValidateSkillStructureParams {
  filePath: string
}

export interface ValidateSkillStructureResult {
  valid: boolean
  missingSections: string[]
  malformedSections: string[]
}

const SKILL_REQUIRED_SECTIONS = ['Purpose', 'Instructions']
const RULE_REQUIRED_SECTIONS = ['Purpose', 'Rules']

/**
 * Validates that a skill or rule file contains required ## sections.
 * Detection is shared with BuildGraphUseCase (same regex).
 */
export async function validateSkillStructure(
  params: ValidateSkillStructureParams,
): Promise<ValidateSkillStructureResult> {
  const { filePath } = params
  const content = await fs.readFile(filePath, 'utf-8')

  const isRule = filePath.includes(`${path.sep}rules${path.sep}`)
  const requiredSections = isRule ? RULE_REQUIRED_SECTIONS : SKILL_REQUIRED_SECTIONS

  const foundSections = extractSectionHeadings(content)
  const missingSections = requiredSections.filter(
    (s) => !foundSections.includes(s),
  )
  const malformedSections: string[] = []

  // Detect malformed: heading with no content before next ## or EOF
  for (const section of foundSections) {
    const sectionContent = extractSectionContent(content, section)
    if (sectionContent !== null && sectionContent.trim().length === 0) {
      malformedSections.push(section)
    }
  }

  return {
    valid: missingSections.length === 0,
    missingSections,
    malformedSections,
  }
}

export function extractSectionHeadings(content: string): string[] {
  const regex = /^##\s+(.+)$/gm
  const headings: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) headings.push(match[1].trim())
  }
  return headings
}

export function extractSectionContent(
  content: string,
  heading: string,
): string | null {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(
    `^##\\s+${escapedHeading}\\s*$([\\s\\S]*?)(?=^##\\s|$)`,
    'gm',
  )
  const match = regex.exec(content)
  if (!match) return null
  return match[1] ?? ''
}
