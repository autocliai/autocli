import { readdirSync, existsSync, readFileSync } from 'fs'
import path from 'path'

export interface TeamTemplateAgent { name: string; type: string; model?: string; tools?: string[] }
export interface TeamTemplate { name: string; goal: string; agents: TeamTemplateAgent[]; instructions: string; workflow: string; filePath: string }

export class TemplateLoader {
  private templates = new Map<string, TeamTemplate>()

  constructor(dirs: string[]) {
    for (const dir of dirs) {
      if (!existsSync(dir)) continue
      for (const file of readdirSync(dir).filter(f => f.endsWith('.md'))) {
        const filePath = path.join(dir, file)
        const template = this.parse(readFileSync(filePath, 'utf8'), filePath)
        if (template) this.templates.set(template.name, template)
      }
    }
  }

  get(name: string): TeamTemplate | undefined { return this.templates.get(name) }
  list(): TeamTemplate[] { return [...this.templates.values()] }

  private parse(text: string, filePath: string): TeamTemplate | null {
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/)
    if (!fmMatch) return null
    const fm = this.parseFrontmatter(fmMatch[1])
    const body = fmMatch[2]
    const agents: TeamTemplateAgent[] = Array.isArray(fm.agents) ? fm.agents.filter((a: any) => a?.name).map((a: any) => ({ name: a.name, type: a.type || 'worker', model: a.model, tools: a.tools })) : []
    const instrMatch = body.match(/## Instructions\n([\s\S]*?)(?=\n## |$)/)
    const workflowMatch = body.match(/## Workflow\n([\s\S]*?)(?=\n## |$)/)
    return { name: fm.name || path.basename(filePath, '.md'), goal: fm.goal || '', agents, instructions: instrMatch?.[1]?.trim() || '', workflow: workflowMatch?.[1]?.trim() || '', filePath }
  }

  private parseFrontmatter(text: string): Record<string, any> {
    const result: Record<string, any> = {}
    let currentKey = '', currentArray: any[] | null = null
    for (const line of text.split('\n')) {
      const arrayItem = line.match(/^\s+-\s+(.+)/)
      if (arrayItem && currentArray) {
        const val = arrayItem[1].trim()
        if (val.includes(':')) {
          const obj: Record<string, any> = {}
          for (const part of val.split(',').map(p => p.trim())) {
            const colonIdx = part.indexOf(':')
            if (colonIdx < 0) continue
            const k = part.slice(0, colonIdx).trim()
            const v = part.slice(colonIdx + 1).trim()
            if (k && v) obj[k] = v.startsWith('[') && v.endsWith(']') ? v.slice(1, -1).split(',').map((s: string) => s.trim()) : v
          }
          currentArray.push(obj)
        } else currentArray.push(val)
      } else {
        const keyMatch = line.match(/^(\w+):\s*(.*)/)
        if (keyMatch) {
          currentKey = keyMatch[1]; const value = keyMatch[2].trim()
          if (value) { result[currentKey] = value; currentArray = null }
          else { currentArray = []; result[currentKey] = currentArray }
        }
      }
    }
    return result
  }
}
