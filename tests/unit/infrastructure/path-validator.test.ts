import { validatePath } from '../../../src/main/infrastructure/fs/path-validator'
import { PathTraversalError } from '../../../src/main/domain/exceptions'
import * as os from 'os'
import * as path from 'path'

const BASE = path.join(os.homedir(), '.claude')

describe('validatePath', () => {
  it('accepts a valid path within base dir', () => {
    const input = path.join(BASE, 'skills', 'my-skill', 'SKILL.md')
    expect(() => validatePath(input, BASE)).not.toThrow()
  })

  it('rejects path with .. traversal', () => {
    const input = path.join(BASE, '..', 'etc', 'passwd')
    expect(() => validatePath(input, BASE)).toThrow(PathTraversalError)
  })

  it('rejects path with null bytes', () => {
    expect(() => validatePath('/path/with\x00null', BASE)).toThrow(PathTraversalError)
  })

  it('rejects path that resolves outside base dir', () => {
    expect(() => validatePath('/etc/passwd', BASE)).toThrow(PathTraversalError)
  })

  it('accepts base dir itself', () => {
    expect(() => validatePath(BASE, BASE)).not.toThrow()
  })
})
