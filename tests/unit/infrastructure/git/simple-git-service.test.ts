import { SimpleGitService } from '@main/infrastructure/git/simple-git-service'
import * as electronLog from 'electron-log'

jest.mock('simple-git')
jest.mock('electron-log')
jest.mock('fs/promises')

import simpleGit from 'simple-git'
import * as fs from 'fs/promises'

describe('SimpleGitService', () => {
  let service: SimpleGitService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new SimpleGitService()
  })

  describe('isGitRepo', () => {
    it('should return true when directory is a git repo', async () => {
      const mockGit = {
        status: jest.fn().mockResolvedValue({}),
      }
      jest.mocked(simpleGit).mockReturnValue(mockGit as any)

      const result = await service.isGitRepo('/path/to/repo')

      expect(result).toBe(true)
      expect(simpleGit).toHaveBeenCalledWith('/path/to/repo')
      expect(mockGit.status).toHaveBeenCalled()
    })

    it('should return false when directory is not a git repo', async () => {
      const mockGit = {
        status: jest.fn().mockRejectedValue(new Error('Not a git repo')),
      }
      jest.mocked(simpleGit).mockReturnValue(mockGit as any)

      const result = await service.isGitRepo('/path/to/non-repo')

      expect(result).toBe(false)
    })

    it('should handle status check errors gracefully', async () => {
      const mockGit = {
        status: jest.fn().mockRejectedValue(new Error('Permission denied')),
      }
      jest.mocked(simpleGit).mockReturnValue(mockGit as any)

      const result = await service.isGitRepo('/path')

      expect(result).toBe(false)
    })
  })

  describe('installPreCommitHook', () => {
    it('should write pre-commit hook file with correct permissions', async () => {
      jest.mocked(fs.writeFile).mockResolvedValue(undefined as any)
      jest.mocked(fs.chmod).mockResolvedValue(undefined as any)

      await service.installPreCommitHook('/repo/path')

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/repo/path/.git/hooks/pre-commit',
        expect.stringContaining('Claude Config Studio'),
        expect.objectContaining({
          encoding: 'utf-8',
          mode: 0o755,
        }),
      )
      expect(fs.chmod).toHaveBeenCalledWith('/repo/path/.git/hooks/pre-commit', 0o755)
      expect(electronLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'simple-git-service',
          op: 'installPreCommitHook',
          repoPath: '/repo/path',
        }),
      )
    })

    it('should log warning when writeFile fails', async () => {
      const error = new Error('Permission denied')
      jest.mocked(fs.writeFile).mockRejectedValue(error)

      await service.installPreCommitHook('/repo/path')

      expect(electronLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'simple-git-service',
          op: 'installPreCommitHook',
        }),
      )
    })

    it('should log warning when chmod fails', async () => {
      const error = new Error('chmod failed')
      jest.mocked(fs.writeFile).mockResolvedValue(undefined)
      jest.mocked(fs.chmod).mockRejectedValue(error)

      await service.installPreCommitHook('/repo/path')

      expect(electronLog.warn).toHaveBeenCalledWith(expect.any(Object))
    })

    it('should include api key pattern in hook script', async () => {
      jest.mocked(fs.writeFile).mockResolvedValue(undefined as any)
      jest.mocked(fs.chmod).mockResolvedValue(undefined as any)

      await service.installPreCommitHook('/repo')

      const hookContent = jest.mocked(fs.writeFile).mock.calls[0]?.[1] as string
      expect(hookContent).toContain('sk-ant-')
      expect(hookContent).toContain('WARNING: Possible Anthropic API key detected')
    })
  })
})
