import {
  isNewerThan,
  exceedsLimit,
  DEFAULT_BACKUP_POLICY,
} from '../../../src/main/domain/models/snapshot'
import type { Snapshot } from '../../../src/main/domain/models/snapshot'

const makeSnapshot = (timestamp: Date): Snapshot => ({
  originalFilePath: '/home/.claude/skills/foo/SKILL.md',
  snapshotPath: '/home/.claude/.backups/foo.md',
  timestamp,
  sizeBytes: 512,
  previewLine: '# Foo skill',
})

describe('Snapshot', () => {
  describe('isNewerThan', () => {
    it('returns true when a is newer', () => {
      const a = makeSnapshot(new Date('2026-01-02'))
      const b = makeSnapshot(new Date('2026-01-01'))
      expect(isNewerThan(a, b)).toBe(true)
    })

    it('returns false when a is older', () => {
      const a = makeSnapshot(new Date('2026-01-01'))
      const b = makeSnapshot(new Date('2026-01-02'))
      expect(isNewerThan(a, b)).toBe(false)
    })
  })

  describe('exceedsLimit', () => {
    it('returns false when at limit', () => {
      expect(exceedsLimit({ maxSnapshotsPerFile: 50 }, 50)).toBe(false)
    })

    it('returns true when over limit', () => {
      expect(exceedsLimit({ maxSnapshotsPerFile: 50 }, 51)).toBe(true)
    })
  })

  describe('DEFAULT_BACKUP_POLICY', () => {
    it('has maxSnapshotsPerFile of 50', () => {
      expect(DEFAULT_BACKUP_POLICY.maxSnapshotsPerFile).toBe(50)
    })
  })
})
