import type { SkillNode } from '../../domain/models/skill-node'

export interface ISkillNodeRepository {
  findBySlug(slug: string, claudePath: string): Promise<SkillNode | null>
  findAll(claudePath: string): Promise<SkillNode[]>
  save(node: SkillNode): Promise<void>
  toggle(slug: string, claudePath: string, enabled: boolean): Promise<SkillNode>
}
