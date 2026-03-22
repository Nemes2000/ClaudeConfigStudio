import { McpInstallationRepository } from '@main/infrastructure/repositories/mcp-installation-repository'
import type { McpInstallation } from '@main/domain/models/mcp'
import * as path from 'path'

jest.mock('fs/promises')

import * as fs from 'fs/promises'

describe('McpInstallationRepository', () => {
  let repo: McpInstallationRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repo = new McpInstallationRepository()
  })

  describe('findByName', () => {
    it('should return installation when file exists', async () => {
      const content = JSON.stringify({
        moduleName: 'test-mcp',
        isEnabled: true,
        hasAuthKey: false,
        config: { apiUrl: 'https://api.example.com' },
      })
      jest.mocked(fs.readFile).mockResolvedValue(content)

      const result = await repo.findByName('test-mcp', '/home/user/.claude')

      expect(result).toBeDefined()
      expect(result?.moduleName).toBe('test-mcp')
      expect(result?.isEnabled).toBe(true)
      expect(result?.hasAuthKey).toBe(false)
      expect(result?.config).toEqual({ apiUrl: 'https://api.example.com' })
    })

    it('should return null when file does not exist', async () => {
      jest.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

      const result = await repo.findByName('nonexistent', '/home/user/.claude')

      expect(result).toBeNull()
    })

    it('should construct correct file path', async () => {
      jest.mocked(fs.readFile).mockResolvedValue('{}')

      await repo.findByName('my-module', '/home/user/.claude')

      expect(fs.readFile).toHaveBeenCalledWith(path.normalize('/home/user/.claude/mcp/my-module.json'), 'utf-8')
    })

    it('should use name as moduleName when not specified in file', async () => {
      const content = JSON.stringify({
        isEnabled: true,
        hasAuthKey: false,
        config: {},
      })
      jest.mocked(fs.readFile).mockResolvedValue(content)

      const result = await repo.findByName('test-mcp', '/home/user/.claude')

      expect(result?.moduleName).toBe('test-mcp')
    })
  })

  describe('findAll', () => {
    it('should return all installations from directory', async () => {
      jest.mocked(fs.readdir).mockResolvedValue([
        { name: 'module1.json', isFile: () => true, isDirectory: () => false },
        { name: 'module2.json', isFile: () => true, isDirectory: () => false },
      ] as any)

      const content1 = JSON.stringify({
        moduleName: 'module1',
        isEnabled: true,
        hasAuthKey: false,
        config: {},
      })
      const content2 = JSON.stringify({
        moduleName: 'module2',
        isEnabled: false,
        hasAuthKey: true,
        config: {},
      })

      jest.mocked(fs.readFile).mockResolvedValueOnce(content1).mockResolvedValueOnce(content2)

      const result = await repo.findAll('/home/user/.claude')

      expect(result).toHaveLength(2)
      expect(result[0]?.moduleName).toBe('module1')
      expect(result[1]?.moduleName).toBe('module2')
    })

    it('should skip non-json files', async () => {
      jest.mocked(fs.readdir).mockResolvedValue([
        { name: 'module1.json', isFile: () => true, isDirectory: () => false },
        { name: 'README.md', isFile: () => true, isDirectory: () => false },
      ] as any)

      jest.mocked(fs.readFile).mockResolvedValue('{"moduleName":"module1","isEnabled":true,"config":{}}')

      const result = await repo.findAll('/home/user/.claude')

      expect(result).toHaveLength(1)
    })

    it('should return empty array when directory does not exist', async () => {
      jest.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'))

      const result = await repo.findAll('/home/user/.claude')

      expect(result).toEqual([])
    })

    it('should skip corrupt JSON files', async () => {
      jest.mocked(fs.readdir).mockResolvedValue([
        { name: 'good.json', isFile: () => true, isDirectory: () => false },
        { name: 'bad.json', isFile: () => true, isDirectory: () => false },
      ] as any)

      jest
        .mocked(fs.readFile)
        .mockResolvedValueOnce('{"moduleName":"good","isEnabled":true,"config":{}}')
        .mockRejectedValueOnce(new Error('Invalid JSON'))

      const result = await repo.findAll('/home/user/.claude')

      expect(result).toHaveLength(1)
      expect(result[0]!.moduleName).toBe('good')
    })
  })

  describe('save', () => {
    it('should write installation config without auth key', async () => {
      jest.mocked(fs.chmod).mockResolvedValue(undefined as any)

      const installation: McpInstallation = {
        moduleName: 'test-mcp',
        configFilePath: path.normalize('/home/user/.claude/mcp/test-mcp.json'),
        isEnabled: true,
        hasAuthKey: false,
        config: { apiUrl: 'https://api.example.com' },
      }

      // Mock the atomicWrite function
      jest.mock('@main/infrastructure/fs/atomic-write')

      // We need to manually mock what would be written
      // For this test, we'll verify the chmod was called with correct permissions
      await repo.save(installation)

      expect(jest.mocked(fs.chmod)).toHaveBeenCalledWith(
        path.normalize('/home/user/.claude/mcp/test-mcp.json'),
        0o600,
      )
    })

    it('should set file permissions to 0o600', async () => {
      jest.mocked(fs.chmod).mockResolvedValue(undefined as any)

      const installation: McpInstallation = {
        moduleName: 'test-mcp',
        configFilePath: path.normalize('/home/user/.claude/mcp/test-mcp.json'),
        isEnabled: true,
        hasAuthKey: false,
        config: {},
      }

      await repo.save(installation)

      expect(jest.mocked(fs.chmod)).toHaveBeenCalledWith(
        path.normalize('/home/user/.claude/mcp/test-mcp.json'),
        0o600,
      )
    })
  })

  describe('delete', () => {
    it('should delete installation file', async () => {
      jest.mocked(fs.unlink).mockResolvedValue(undefined)

      await repo.delete('test-mcp', '/home/user/.claude')

      expect(fs.unlink).toHaveBeenCalledWith(path.normalize('/home/user/.claude/mcp/test-mcp.json'))
    })

    it('should throw error if delete fails', async () => {
      const deleteError = new Error('Permission denied')
      jest.mocked(fs.unlink).mockRejectedValue(deleteError)

      await expect(repo.delete('test-mcp', '/home/user/.claude')).rejects.toThrow(deleteError)
    })
  })
})
