import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { atomicWrite } from '../../../src/main/infrastructure/fs/atomic-write'

describe('atomicWrite', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-write-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('writes content to the target path', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await atomicWrite(filePath, '# Hello')
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toBe('# Hello')
  })

  it('creates parent directories if they do not exist', async () => {
    const filePath = path.join(tmpDir, 'deep', 'nested', 'file.md')
    await atomicWrite(filePath, 'content')
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toBe('content')
  })

  it('leaves no .tmp file behind on success', async () => {
    const filePath = path.join(tmpDir, 'clean.md')
    await atomicWrite(filePath, 'clean content')
    const files = await fs.readdir(tmpDir)
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('overwrites existing file', async () => {
    const filePath = path.join(tmpDir, 'overwrite.md')
    await atomicWrite(filePath, 'original')
    await atomicWrite(filePath, 'updated')
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toBe('updated')
  })
})
