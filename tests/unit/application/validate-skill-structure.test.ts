import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { validateSkillStructure } from '../../../src/main/application/queries/validate-skill-structure-use-case'

async function writeTemp(filename: string, content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccs-test-'))
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, content)
  return filePath
}

describe('validateSkillStructure', () => {
  it('returns valid for a skill with Purpose + Instructions sections', async () => {
    const content = `---\nname: test\n---\n\n## Purpose\n\nDoes things.\n\n## Instructions\n\n1. Step one.\n`
    const filePath = await writeTemp(
      'SKILL.md',
      content,
    )
    // Simulate skill path by writing inside skills/ directory
    const dir = path.dirname(filePath)
    const skillPath = path.join(dir, 'skills', 'my-skill', 'SKILL.md')
    await fs.mkdir(path.dirname(skillPath), { recursive: true })
    await fs.writeFile(skillPath, content)

    const result = await validateSkillStructure({ filePath: skillPath })
    expect(result.valid).toBe(true)
    expect(result.missingSections).toHaveLength(0)
  })

  it('reports missing Instructions section for a skill', async () => {
    const content = `---\nname: test\n---\n\n## Purpose\n\nDoes things.\n`
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccs-skill-'))
    const skillPath = path.join(dir, 'skills', 'partial', 'SKILL.md')
    await fs.mkdir(path.dirname(skillPath), { recursive: true })
    await fs.writeFile(skillPath, content)

    const result = await validateSkillStructure({ filePath: skillPath })
    expect(result.valid).toBe(false)
    expect(result.missingSections).toContain('Instructions')
  })

  it('detects rule files by path and requires Purpose + Rules', async () => {
    const content = `---\nname: test\n---\n\n## Purpose\n\nDoes things.\n`
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccs-rule-'))
    const rulePath = path.join(dir, 'rules', 'my-rule.md')
    await fs.mkdir(path.dirname(rulePath), { recursive: true })
    await fs.writeFile(rulePath, content)

    const result = await validateSkillStructure({ filePath: rulePath })
    expect(result.valid).toBe(false)
    expect(result.missingSections).toContain('Rules')
  })
})
