import { getDb } from './db.js'
import path from 'path'
import { readdirSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { logger } from '../utils/logger.js'

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference'

export interface MemoryEntry {
  name: string
  description: string
  type: MemoryType
  content: string
  filePath?: string
}

export class MemoryStore {
  private dir: string

  constructor(dir: string) {
    this.dir = dir
    mkdirSync(dir, { recursive: true })
  }

  async save(entry: Omit<MemoryEntry, 'filePath'>): Promise<void> {
    const filePath = path.join(this.dir, `${entry.name}.md`)
    const md = ['---', `name: ${entry.name}`, `description: ${entry.description}`, `type: ${entry.type}`, '---', '', entry.content].join('\n')
    await Bun.write(filePath, md)
    this.upsertFts(entry.name, entry.description, entry.type, entry.content, filePath)
    await this.updateIndex()
  }

  async get(name: string): Promise<MemoryEntry | null> {
    const filePath = path.join(this.dir, `${name}.md`)
    const file = Bun.file(filePath)
    if (!(await file.exists())) return null
    const text = await file.text()
    return this.parseMarkdown(text, filePath)
  }

  search(query: string): MemoryEntry[] {
    const db = getDb()
    try {
      const safeQuery = '"' + query.replace(/"/g, '""') + '"'
      const rows = db.query('SELECT name, description, type, content, file_path FROM memory_fts WHERE memory_fts MATCH ? ORDER BY rank LIMIT 10').all(safeQuery) as any[]
      return rows.map(r => ({ name: r.name, description: r.description, type: r.type as MemoryType, content: r.content, filePath: r.file_path }))
    } catch (e) { logger.warn('Memory FTS search error', { query, error: String(e) }); return [] }
  }

  list(): MemoryEntry[] {
    const db = getDb()
    const rows = db.query('SELECT name, description, type, content, file_path FROM memory_fts').all() as any[]
    return rows.map(r => ({ name: r.name, description: r.description, type: r.type as MemoryType, content: r.content, filePath: r.file_path }))
  }

  async delete(name: string): Promise<void> {
    const filePath = path.join(this.dir, `${name}.md`)
    try { unlinkSync(filePath) } catch {}
    getDb().query('DELETE FROM memory_fts WHERE name = ?').run(name)
    await this.updateIndex()
  }

  async sync(): Promise<void> {
    if (!existsSync(this.dir)) return
    const files = readdirSync(this.dir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md')
    for (const file of files) {
      const filePath = path.join(this.dir, file)
      const text = await Bun.file(filePath).text()
      const entry = this.parseMarkdown(text, filePath)
      if (entry) this.upsertFts(entry.name, entry.description, entry.type, entry.content, filePath)
    }
    logger.info('Memory FTS sync complete', { count: files.length })
  }

  buildPromptSection(): string {
    const entries = this.list()
    if (entries.length === 0) return ''
    const lines = entries.map(e => `- **${e.name}** (${e.type}): ${e.description}`)
    return `\n## Memory\n${lines.join('\n')}\n`
  }

  private upsertFts(name: string, description: string, type: string, content: string, filePath: string): void {
    const db = getDb()
    db.query('DELETE FROM memory_fts WHERE name = ?').run(name)
    db.query('INSERT INTO memory_fts (name, description, type, content, file_path) VALUES (?, ?, ?, ?, ?)').run(name, description, type, content, filePath)
  }

  private parseMarkdown(text: string, filePath: string): MemoryEntry | null {
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/)
    if (!fmMatch) return null
    const fm: Record<string, string> = {}
    for (const line of fmMatch[1].split('\n')) {
      const idx = line.indexOf(':')
      if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
    return { name: fm.name || path.basename(filePath, '.md'), description: fm.description || '', type: (fm.type as MemoryType) || 'reference', content: fmMatch[2].trim(), filePath }
  }

  private async updateIndex(): Promise<void> {
    const entries = this.list()
    const lines = ['# Memory Index', '', ...entries.map(e => `- [${e.name}](${e.name}.md) — ${e.description}`)]
    await Bun.write(path.join(this.dir, 'MEMORY.md'), lines.join('\n'))
  }
}
