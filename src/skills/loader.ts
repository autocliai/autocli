import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { SkillDefinition, SkillMetadata } from './types.js'

export class SkillLoader {
  private skills = new Map<string, SkillDefinition>()

  constructor(dirs: string[]) {
    for (const dir of dirs) {
      if (!existsSync(dir)) continue
      this.loadDir(dir)
    }
  }

  private loadDir(dir: string): void {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      const filePath = join(dir, file)
      const raw = readFileSync(filePath, 'utf-8')
      const skill = this.parseSkill(raw, filePath)
      if (skill) this.skills.set(skill.name, skill)
    }
  }

  private parseSkill(raw: string, filePath: string): SkillDefinition | undefined {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) return undefined

    const frontmatter = match[1]
    const content = match[2].trim()

    const name = this.extractField(frontmatter, 'name')
    const description = this.extractField(frontmatter, 'description')
    const toolsRaw = this.extractField(frontmatter, 'allowed-tools')
      || this.extractField(frontmatter, 'tools')
    const allowedTools = toolsRaw
      ? toolsRaw.split(',').map(t => t.trim()).filter(Boolean)
      : undefined

    if (!name) return undefined

    return { name, description: description || '', content, filePath, allowedTools }
  }

  private extractField(frontmatter: string, field: string): string | undefined {
    const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))
    return match ? match[1].trim() : undefined
  }

  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name)
  }

  list(): SkillMetadata[] {
    return Array.from(this.skills.values()).map(s => ({
      name: s.name,
      description: s.description,
    }))
  }
}
