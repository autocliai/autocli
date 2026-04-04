import { getDb } from './db.js'
import path from 'path'
import { readdirSync, existsSync, mkdirSync } from 'fs'
import { logger } from '../utils/logger.js'

export type PARACategory = 'projects' | 'areas' | 'resources' | 'archives'

export interface BrainNote {
  id: string
  title: string
  content: string
  category: PARACategory
  tags: string[]
  links: string[]
  createdAt: string
  updatedAt: string
  source?: string
  filePath?: string
}

interface WriteNoteInput {
  title: string
  content: string
  category: PARACategory
  tags: string[]
  source?: string
}

export const MAX_RECALL_NOTES = 5

export class BrainStore {
  private dir: string

  constructor(dir: string) {
    this.dir = dir
    for (const cat of ['projects', 'areas', 'resources', 'archives'] as PARACategory[]) {
      mkdirSync(path.join(dir, cat), { recursive: true })
    }
  }

  async writeNote(input: WriteNoteInput): Promise<BrainNote> {
    const id = crypto.randomUUID().slice(0, 12)
    const now = new Date().toISOString()
    const links = this.extractLinks(input.content)
    const contentTags = this.extractTags(input.content)
    const allTags = [...new Set([...input.tags, ...contentTags])]

    const note: BrainNote = {
      id, title: input.title, content: input.content, category: input.category,
      tags: allTags, links, createdAt: now, updatedAt: now, source: input.source,
    }

    const filePath = path.join(this.dir, input.category, `${id}.md`)
    note.filePath = filePath

    const md = [
      '---', `id: ${id}`, `title: ${input.title}`, `category: ${input.category}`,
      `tags: ${allTags.join(', ')}`, `created: ${now}`, `updated: ${now}`,
      input.source ? `source: ${input.source}` : null, '---', '', input.content,
    ].filter(Boolean).join('\n')

    await Bun.write(filePath, md)
    this.upsertFts(note)
    return note
  }

  search(query: string, limit = MAX_RECALL_NOTES): BrainNote[] {
    const db = getDb()
    try {
      const safeQuery = '"' + query.replace(/"/g, '""') + '"'
      const rows = db.query('SELECT title, category, tags, content, file_path FROM brain_fts WHERE brain_fts MATCH ? ORDER BY rank LIMIT ?').all(safeQuery, limit) as any[]
      return rows.map(r => this.ftsRowToNote(r))
    } catch (e) { logger.warn('Brain FTS search error', { query, error: String(e) }); return [] }
  }

  listByCategory(category: PARACategory): BrainNote[] {
    const db = getDb()
    try {
      const rows = db.query('SELECT title, category, tags, content, file_path FROM brain_fts WHERE brain_fts MATCH ?').all(`category:${category}`) as any[]
      return rows.map(r => this.ftsRowToNote(r))
    } catch (e) { logger.warn('Brain FTS listByCategory error', { category, error: String(e) }); return [] }
  }

  async archiveNote(id: string): Promise<void> {
    for (const cat of ['projects', 'areas', 'resources'] as PARACategory[]) {
      const fp = path.join(this.dir, cat, `${id}.md`)
      if (existsSync(fp)) {
        const text = await Bun.file(fp).text()
        const newPath = path.join(this.dir, 'archives', `${id}.md`)
        const updated = text.replace(/^category:\s*\S+/m, 'category: archives')
        await Bun.write(newPath, updated)
        const { unlinkSync } = await import('fs')
        unlinkSync(fp)
        const note = this.parseNoteMarkdown(updated, newPath)
        if (note) this.upsertFts(note)
        return
      }
    }
  }

  getStats(): { total: number; byCategory: Record<string, number> } {
    const db = getDb()
    try {
      const total = (db.query('SELECT COUNT(*) as c FROM brain_fts').get() as any)?.c ?? 0
      const byCat: Record<string, number> = {}
      for (const cat of ['projects', 'areas', 'resources', 'archives']) {
        byCat[cat] = (db.query('SELECT COUNT(*) as c FROM brain_fts WHERE brain_fts MATCH ?').get(`category:${cat}`) as any)?.c ?? 0
      }
      return { total, byCategory: byCat }
    } catch { return { total: 0, byCategory: { projects: 0, areas: 0, resources: 0, archives: 0 } } }
  }

  async sync(): Promise<void> {
    if (!existsSync(this.dir)) return
    for (const cat of ['projects', 'areas', 'resources', 'archives'] as PARACategory[]) {
      const catDir = path.join(this.dir, cat)
      if (!existsSync(catDir)) continue
      const files = readdirSync(catDir).filter(f => f.endsWith('.md'))
      for (const file of files) {
        const filePath = path.join(catDir, file)
        const text = await Bun.file(filePath).text()
        const note = this.parseNoteMarkdown(text, filePath)
        if (note) this.upsertFts(note)
      }
    }
    logger.info('Brain FTS sync complete')
  }

  buildPromptSection(query: string): string {
    const notes = this.search(query)
    if (notes.length === 0) return ''
    const sections = notes.map(n => `### ${n.title} (${n.category})\n${n.content.slice(0, 500)}`)
    return `\n## Second Brain\n${sections.join('\n\n')}\n`
  }

  private upsertFts(note: BrainNote): void {
    const db = getDb()
    db.query('DELETE FROM brain_fts WHERE file_path = ?').run(note.filePath || '')
    db.query('INSERT INTO brain_fts (title, category, tags, content, file_path) VALUES (?, ?, ?, ?, ?)').run(note.title, note.category, note.tags.join(', '), note.content, note.filePath || '')
  }

  private ftsRowToNote(row: any): BrainNote {
    const fp = row.file_path || ''
    const id = path.basename(fp, '.md')
    return {
      id, title: row.title, content: row.content, category: row.category as PARACategory,
      tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [], links: this.extractLinks(row.content),
      createdAt: '', updatedAt: '', filePath: fp,
    }
  }

  private parseNoteMarkdown(text: string, filePath: string): BrainNote | null {
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/)
    if (!fmMatch) return null
    const fm: Record<string, string> = {}
    for (const line of fmMatch[1].split('\n')) {
      const idx = line.indexOf(':')
      if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
    const content = fmMatch[2].trim()
    return {
      id: fm.id || path.basename(filePath, '.md'), title: fm.title || '', content,
      category: (fm.category as PARACategory) || 'resources',
      tags: fm.tags ? fm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      links: this.extractLinks(content), createdAt: fm.created || '', updatedAt: fm.updated || '',
      source: fm.source, filePath,
    }
  }

  private extractLinks(content: string): string[] {
    const matches = content.match(/\[\[([^\]]+)\]\]/g) || []
    return matches.map(m => m.slice(2, -2))
  }

  private extractTags(content: string): string[] {
    const matches = content.match(/#([a-zA-Z][\w-]*)/g) || []
    return matches.map(m => m.slice(1))
  }
}
