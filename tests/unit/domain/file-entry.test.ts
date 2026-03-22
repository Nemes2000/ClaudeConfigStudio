import { createFileEntry } from '@main/domain/models/file-entry'

describe('FileEntry', () => {
  describe('createFileEntry', () => {
    it('should create a file entry with all properties', () => {
      const entry = createFileEntry(
        '/absolute/path/file.md',
        'relative/path/file.md',
        'file content',
        true,
      )

      expect(entry.absolutePath).toBe('/absolute/path/file.md')
      expect(entry.relativePath).toBe('relative/path/file.md')
      expect(entry.content).toBe('file content')
      expect(entry.exists).toBe(true)
    })

    it('should create a file entry with exists=false', () => {
      const entry = createFileEntry('/path/file.md', 'file.md', '', false)

      expect(entry.exists).toBe(false)
      expect(entry.content).toBe('')
    })

    it('should preserve content exactly as provided', () => {
      const content = 'line1\nline2\nline3'
      const entry = createFileEntry('/path', 'path', content, true)

      expect(entry.content).toBe(content)
    })
  })
})
