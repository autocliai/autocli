import type { SkillDefinition } from './types.js'
import { readdirSync, existsSync, readFileSync } from 'fs'
import path from 'path'

export class SkillLoader {
  private skills = new Map<string, SkillDefinition>()

  constructor(dirs: string[]) {
    for (const dir of dirs) {
      if (!existsSync(dir)) continue
      const files = readdirSync(dir).filter(f => f.endsWith('.md'))
      for (const file of files) {
        const filePath = path.join(dir, file)
        const text = readFileSync(filePath, 'utf8')
        const skill = this.parse(text, filePath)
        if (skill) this.skills.set(skill.name, skill)
      }
    }
  }

  get(name: string): SkillDefinition | undefined { return this.skills.get(name) }
  list(): SkillDefinition[] { return [...this.skills.values()] }

  private parse(text: string, filePath: string): SkillDefinition | null {
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/)
    if (!fmMatch) return null
    const fm: Record<string, string> = {}
    for (const line of fmMatch[1].split('\n')) {
      const idx = line.indexOf(':')
      if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
    return {
      name: fm.name || path.basename(filePath, '.md'),
      description: fm.description || '',
      allowedTools: fm['allowed-tools']?.split(',').map(t => t.trim()),
      content: fmMatch[2].trim(),
      filePath,
    }
  }
}
