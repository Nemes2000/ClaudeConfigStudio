import {
  isValidWorkspaceFolder,
  type WorkspaceFolder,
} from '../../../src/main/domain/models/workspace-folder'

describe('isValidWorkspaceFolder', () => {
  it('returns true for valid workspace folder', () => {
    const folder: WorkspaceFolder = {
      path: '/home/user/project',
      label: 'My Project',
    }

    expect(isValidWorkspaceFolder(folder)).toBe(true)
  })

  it('returns true for absolute Unix path', () => {
    const folder: WorkspaceFolder = {
      path: '/home/user/project',
      label: 'Unix Project',
    }

    expect(isValidWorkspaceFolder(folder)).toBe(true)
  })

  it('returns false when path is relative', () => {
    const folder: WorkspaceFolder = {
      path: './project',
      label: 'Relative Project',
    }

    expect(isValidWorkspaceFolder(folder)).toBe(false)
  })

  it('returns false when path is empty string', () => {
    const folder: WorkspaceFolder = {
      path: '',
      label: 'Empty Path',
    }

    expect(isValidWorkspaceFolder(folder)).toBe(false)
  })

  it('returns false when path is not a string', () => {
    const folder = {
      path: 123,
      label: 'Invalid Path Type',
    } as unknown as WorkspaceFolder

    expect(isValidWorkspaceFolder(folder)).toBe(false)
  })

  it('returns false when label is empty string', () => {
    const folder: WorkspaceFolder = {
      path: '/home/user/project',
      label: '',
    }

    expect(isValidWorkspaceFolder(folder)).toBe(false)
  })

  it('returns false when label is not a string', () => {
    const folder = {
      path: '/home/user/project',
      label: 123,
    } as unknown as WorkspaceFolder

    expect(isValidWorkspaceFolder(folder)).toBe(false)
  })

  it('returns false when both path and label are invalid', () => {
    const folder = {
      path: '',
      label: '',
    } as unknown as WorkspaceFolder

    expect(isValidWorkspaceFolder(folder)).toBe(false)
  })

  it('returns true for path with spaces', () => {
    const folder: WorkspaceFolder = {
      path: '/home/user/my project name',
      label: 'Project with Spaces',
    }

    expect(isValidWorkspaceFolder(folder)).toBe(true)
  })

  it('returns true for label with special characters', () => {
    const folder: WorkspaceFolder = {
      path: '/home/user/project',
      label: 'Project (2024) - Main',
    }

    expect(isValidWorkspaceFolder(folder)).toBe(true)
  })

  it('returns false when path is null', () => {
    const folder = {
      path: null,
      label: 'Test',
    } as unknown as WorkspaceFolder

    expect(isValidWorkspaceFolder(folder)).toBe(false)
  })

  it('returns false when label is null', () => {
    const folder = {
      path: '/home/user/project',
      label: null,
    } as unknown as WorkspaceFolder

    expect(isValidWorkspaceFolder(folder)).toBe(false)
  })
})
