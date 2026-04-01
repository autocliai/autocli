import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, openSync, closeSync, writeSync, readSync, ftruncateSync } from 'fs'
import { join } from 'path'
import type { BrainNote, BrainIndex, PARACategory } from './types.js'
import { extractLinks, extractTags } from './utils.js'

export class BrainWriter {
  private baseDir: string
  private indexPath: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
    this.indexPath = join(baseDir, '_index.json')
    // Create PARA directories
    for (const cat of ['projects', 'areas', 'resources', 'archives'] as PARACategory[]) {
      mkdirSync(join(baseDir, cat), { recursive: true })
    }
  }

  write(title: string, content: string, category: PARACategory, opts?: { tags?: string[]; source?: string }): BrainNote {
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const links = extractLinks(content)
    const tags = [...(opts?.tags || []), ...extractTags(content)]

    const note: BrainNote = {
      id,
      title,
      content,
      category,
      tags: [...new Set(tags)],
      links: links.map(l => l.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: opts?.source,
    }

    // Check if note exists (update vs create)
    const notePath = join(this.baseDir, category, `${id}.md`)
    if (existsSync(notePath)) {
      const existing = this.readNote(category, id)
      if (existing) {
        note.createdAt = existing.createdAt
      }
    }

    // Write note as markdown with frontmatter
    const md = [
      '---',
      `id: ${note.id}`,
      `title: ${note.title}`,
      `category: ${note.category}`,
      `tags: [${note.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`,
      `links: [${note.links.join(', ')}]`,
      `created: ${new Date(note.createdAt).toISOString()}`,
      `updated: ${new Date(note.updatedAt).toISOString()}`,
      note.source ? `source: ${note.source}` : '',
      '---',
      '',
      note.content,
    ].filter(l => l !== '').join('\n')

    writeFileSync(notePath, md)
    this.updateIndex(note)
    return note
  }

  delete(category: PARACategory, id: string): boolean {
    const path = join(this.baseDir, category, `${id}.md`)
    if (!existsSync(path)) return false
    unlinkSync(path)
    this.removeFromIndex(id)
    return true
  }

  archive(id: string): BrainNote | undefined {
    // Find note in any category and move to archives
    const index = this.loadIndex()
    const meta = index.notes[id]
    if (!meta || meta.category === 'archives') return undefined

    const note = this.readNote(meta.category, id)
    if (!note) return undefined

    this.delete(meta.category, id)
    return this.write(note.title, note.content, 'archives', { tags: note.tags, source: note.source })
  }

  private readNote(category: PARACategory, id: string): BrainNote | undefined {
    const path = join(this.baseDir, category, `${id}.md`)
    if (!existsSync(path)) return undefined
    const raw = readFileSync(path, 'utf-8')
    return this.parseNote(raw, id, category)
  }

  private parseNote(raw: string, id: string, category: PARACategory): BrainNote | undefined {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) return undefined

    const content = match[2].trim()
    const fm = match[1]

    const getField = (name: string): string => {
      const m = fm.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))
      return m ? m[1].trim() : ''
    }

    const getArray = (name: string): string[] => {
      const val = getField(name)
      if (!val || val === '[]') return []
      return val.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean)
    }

    return {
      id,
      title: getField('title') || id,
      content,
      category,
      tags: getArray('tags'),
      links: getArray('links'),
      createdAt: new Date(getField('created') || Date.now()).getTime(),
      updatedAt: new Date(getField('updated') || Date.now()).getTime(),
      source: getField('source') || undefined,
    }
  }

  loadIndex(): BrainIndex {
    if (!existsSync(this.indexPath)) {
      return { notes: {}, backlinks: {}, tags: {} }
    }
    try {
      return JSON.parse(readFileSync(this.indexPath, 'utf-8'))
    } catch {
      return { notes: {}, backlinks: {}, tags: {} }
    }
  }

  private updateIndex(note: BrainNote): void {
    // Atomic read-modify-write via file descriptor to prevent concurrent corruption
    const fd = openSync(this.indexPath, 'a+')
    try {
      const buf = Buffer.alloc(1024 * 1024) // 1MB max index
      const bytesRead = readSync(fd, buf, 0, buf.length, 0)
      const index: BrainIndex = bytesRead > 0
        ? JSON.parse(buf.slice(0, bytesRead).toString('utf-8'))
        : { notes: {}, backlinks: {}, tags: {} }

      // Update note entry
      index.notes[note.id] = {
        title: note.title,
        category: note.category,
        tags: note.tags,
        links: note.links,
        updatedAt: note.updatedAt,
      }

      // Update backlinks
      for (const linkId of note.links) {
        if (!index.backlinks[linkId]) index.backlinks[linkId] = []
        if (!index.backlinks[linkId].includes(note.id)) {
          index.backlinks[linkId].push(note.id)
        }
      }

      // Update tag index
      for (const tag of note.tags) {
        if (!index.tags[tag]) index.tags[tag] = []
        if (!index.tags[tag].includes(note.id)) {
          index.tags[tag].push(note.id)
        }
      }

      const data = Buffer.from(JSON.stringify(index, null, 2))
      ftruncateSync(fd, 0)
      writeSync(fd, data, 0, data.length, 0)
    } finally {
      closeSync(fd)
    }
  }

  private removeFromIndex(id: string): void {
    const index = this.loadIndex()
    delete index.notes[id]
    // Clean backlinks
    for (const [key, ids] of Object.entries(index.backlinks)) {
      index.backlinks[key] = ids.filter(i => i !== id)
    }
    delete index.backlinks[id]
    // Clean tags
    for (const [tag, ids] of Object.entries(index.tags)) {
      index.tags[tag] = ids.filter(i => i !== id)
    }
    writeFileSync(this.indexPath, JSON.stringify(index, null, 2))
  }
}
