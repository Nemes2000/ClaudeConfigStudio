import {
  hasDiff,
  type OrchestratorUpdate,
} from '../../../src/main/domain/models/orchestrator-update'

describe('hasDiff', () => {
  it('returns true when oldContent and newContent differ', () => {
    const update: OrchestratorUpdate = {
      orchestratorPath: '/path/to/orchestrator.md',
      oldContent: 'Original content',
      newContent: 'Updated content',
      isPartial: false,
    }

    expect(hasDiff(update)).toBe(true)
  })

  it('returns false when oldContent and newContent are identical', () => {
    const update: OrchestratorUpdate = {
      orchestratorPath: '/path/to/orchestrator.md',
      oldContent: 'Same content',
      newContent: 'Same content',
      isPartial: false,
    }

    expect(hasDiff(update)).toBe(false)
  })

  it('returns true for multiline differences', () => {
    const oldContent = `Line 1
Line 2
Line 3`

    const newContent = `Line 1
Line 2 Modified
Line 3`

    const update: OrchestratorUpdate = {
      orchestratorPath: '/path/to/orchestrator.md',
      oldContent,
      newContent,
      isPartial: true,
    }

    expect(hasDiff(update)).toBe(true)
  })

  it('returns true for whitespace differences', () => {
    const update: OrchestratorUpdate = {
      orchestratorPath: '/path/to/orchestrator.md',
      oldContent: 'content with spaces',
      newContent: 'content  with  spaces',
      isPartial: false,
    }

    expect(hasDiff(update)).toBe(true)
  })

  it('returns false for empty old and new content', () => {
    const update: OrchestratorUpdate = {
      orchestratorPath: '/path/to/orchestrator.md',
      oldContent: '',
      newContent: '',
      isPartial: false,
    }

    expect(hasDiff(update)).toBe(false)
  })

  it('returns true when old is empty and new is not', () => {
    const update: OrchestratorUpdate = {
      orchestratorPath: '/path/to/orchestrator.md',
      oldContent: '',
      newContent: 'New content',
      isPartial: false,
    }

    expect(hasDiff(update)).toBe(true)
  })

  it('returns true when new is empty and old is not', () => {
    const update: OrchestratorUpdate = {
      orchestratorPath: '/path/to/orchestrator.md',
      oldContent: 'Old content',
      newContent: '',
      isPartial: true,
    }

    expect(hasDiff(update)).toBe(true)
  })

  it('ignores isPartial flag when checking for diff', () => {
    const update1: OrchestratorUpdate = {
      orchestratorPath: '/path/to/orchestrator.md',
      oldContent: 'content',
      newContent: 'content',
      isPartial: true,
    }

    const update2: OrchestratorUpdate = {
      orchestratorPath: '/path/to/orchestrator.md',
      oldContent: 'content',
      newContent: 'content',
      isPartial: false,
    }

    expect(hasDiff(update1)).toBe(false)
    expect(hasDiff(update2)).toBe(false)
  })

  it('returns true for case-sensitive differences', () => {
    const update: OrchestratorUpdate = {
      orchestratorPath: '/path/to/orchestrator.md',
      oldContent: 'Content',
      newContent: 'content',
      isPartial: false,
    }

    expect(hasDiff(update)).toBe(true)
  })

  it('returns true for special character differences', () => {
    const update: OrchestratorUpdate = {
      orchestratorPath: '/path/to/orchestrator.md',
      oldContent: 'content-with-dashes',
      newContent: 'content_with_dashes',
      isPartial: false,
    }

    expect(hasDiff(update)).toBe(true)
  })
})
