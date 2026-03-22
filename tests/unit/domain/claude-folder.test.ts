import {
  isEmptyContents,
  validateClaudeFolder,
  type ClaudeFolder,
} from '../../../src/main/domain/models/claude-folder'

describe('isEmptyContents', () => {
  it('returns true when all collections are empty', () => {
    const contents = {
      skills: [],
      rules: [],
      hooks: [],
      mcps: [],
      agentConfig: null,
    }

    expect(isEmptyContents(contents)).toBe(true)
  })

  it('returns false when skills exist', () => {
    const contents = {
      skills: ['/path/to/skill'],
      rules: [],
      hooks: [],
      mcps: [],
      agentConfig: null,
    }

    expect(isEmptyContents(contents)).toBe(false)
  })

  it('returns false when rules exist', () => {
    const contents = {
      skills: [],
      rules: ['/path/to/rule.md'],
      hooks: [],
      mcps: [],
      agentConfig: null,
    }

    expect(isEmptyContents(contents)).toBe(false)
  })

  it('returns false when hooks exist', () => {
    const contents = {
      skills: [],
      rules: [],
      hooks: ['/path/to/hook'],
      mcps: [],
      agentConfig: null,
    }

    expect(isEmptyContents(contents)).toBe(false)
  })

  it('returns false when MCPs exist', () => {
    const contents = {
      skills: [],
      rules: [],
      hooks: [],
      mcps: ['/path/to/mcp'],
      agentConfig: null,
    }

    expect(isEmptyContents(contents)).toBe(false)
  })

  it('returns false when agent config exists', () => {
    const contents = {
      skills: [],
      rules: [],
      hooks: [],
      mcps: [],
      agentConfig: '/path/to/agent.yaml',
    }

    expect(isEmptyContents(contents)).toBe(false)
  })

  it('returns false when multiple items exist', () => {
    const contents = {
      skills: ['/path/to/skill1', '/path/to/skill2'],
      rules: ['/path/to/rule.md'],
      hooks: ['/path/to/hook'],
      mcps: ['/path/to/mcp1', '/path/to/mcp2'],
      agentConfig: '/path/to/agent.yaml',
    }

    expect(isEmptyContents(contents)).toBe(false)
  })
})

describe('validateClaudeFolder', () => {
  it('does not throw when claudePath is under projectPath', () => {
    const folder: ClaudeFolder = {
      projectPath: '/home/user/project',
      claudePath: '/home/user/project/.claude',
      isRootLevel: true,
      contents: {
        skills: [],
        rules: [],
        hooks: [],
        mcps: [],
        agentConfig: null,
      },
    }

    expect(() => validateClaudeFolder(folder)).not.toThrow()
  })

  it('does not throw for nested projects', () => {
    const folder: ClaudeFolder = {
      projectPath: '/home/user/project/subproject',
      claudePath: '/home/user/project/subproject/.claude',
      isRootLevel: false,
      contents: {
        skills: [],
        rules: [],
        hooks: [],
        mcps: [],
        agentConfig: null,
      },
    }

    expect(() => validateClaudeFolder(folder)).not.toThrow()
  })

  it('throws when claudePath is not under projectPath', () => {
    const folder: ClaudeFolder = {
      projectPath: '/home/user/project',
      claudePath: '/home/user/other/.claude',
      isRootLevel: false,
      contents: {
        skills: [],
        rules: [],
        hooks: [],
        mcps: [],
        agentConfig: null,
      },
    }

    expect(() => validateClaudeFolder(folder)).toThrow(Error)
    expect(() => validateClaudeFolder(folder)).toThrow(
      'Invariant violation'
    )
  })

  it('throws when claudePath is completely different', () => {
    const folder: ClaudeFolder = {
      projectPath: '/home/user/project',
      claudePath: '/etc/.claude',
      isRootLevel: false,
      contents: {
        skills: [],
        rules: [],
        hooks: [],
        mcps: [],
        agentConfig: null,
      },
    }

    expect(() => validateClaudeFolder(folder)).toThrow(Error)
  })

  it('error message includes both paths', () => {
    const projectPath = '/home/user/project'
    const claudePath = '/home/user/other/.claude'
    const folder: ClaudeFolder = {
      projectPath,
      claudePath,
      isRootLevel: false,
      contents: {
        skills: [],
        rules: [],
        hooks: [],
        mcps: [],
        agentConfig: null,
      },
    }

    try {
      validateClaudeFolder(folder)
      fail('Should have thrown')
    } catch (e) {
      expect((e as Error).message).toContain(claudePath)
      expect((e as Error).message).toContain(projectPath)
    }
  })
})
