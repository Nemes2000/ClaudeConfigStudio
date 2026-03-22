import * as path from 'path'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import { writeFile } from './write-file-use-case'

export interface CreateSkillParams {
  claudePath: string
  slug: string
  name: string
  description: string
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

export interface CreateSkillResult {
  filePath: string
  content: string
}

const SKILL_SCAFFOLD = (name: string, description: string): string => `---
name: ${name}
description: ${description}
version: 1.0.0
---

## Purpose

<!-- Describe what this skill does and when to use it -->

## Instructions

1. <!-- Step-by-step instructions -->

## Constraints

- <!-- What this skill must NOT do -->
`

export async function createSkill(
  params: CreateSkillParams,
): Promise<CreateSkillResult> {
  const { claudePath, slug, name, description, snapshotRepo, baseDir } = params
  const skillDir = path.join(claudePath, 'skills', slug)
  const filePath = path.join(skillDir, 'SKILL.md')
  const content = SKILL_SCAFFOLD(name, description)
  await writeFile({ filePath, content, snapshotRepo, baseDir })
  return { filePath, content }
}
