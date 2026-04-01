import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import type { BrainNote, BrainIndex, PARACategory, RankedNote } from './types.js'
import { SCORING_WEIGHTS, MAX_RECALL_NOTES, MIN_RECALL_SCORE } from './types.js'
import { jaccardSimilarity, recencyScore } from './utils.js'

export class BrainReader {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  // Ranked recall: find most relevant notes for a query
  recall(query: string, maxResults = MAX_RECALL_NOTES): RankedNote[] {
    const allNotes = this.getAllNotes()
    const index = this.loadIndex()

    // Find max inbound links for normalization
    const maxInbound = Math.max(1, ...Object.values(index.backlinks).map(ids => ids.length))

    const ranked: RankedNote[] = allNotes.map(note => {
      // Text match (Jaccard)
      const textScore = Math.max(
        jaccardSimilarity(query, note.title + ' ' + note.content),
        jaccardSimilarity(query, note.tags.join(' ')),
      )

      // Recency
      const recency = recencyScore(note.updatedAt)

      // Link density (inbound links)
      const inboundLinks = (index.backlinks[note.id] || []).length
      const linkDensity = inboundLinks / maxInbound

      // Weighted score
      const score = (
        textScore * SCORING_WEIGHTS.textMatch +
        recency * SCORING_WEIGHTS.recency +
        linkDensity * SCORING_WEIGHTS.linkDensity
      )

      const reasons: string[] = []
      if (textScore > 0.1) reasons.push(`text:${textScore.toFixed(2)}`)
      if (recency > 0.5) reasons.push('recent')
      if (inboundLinks > 0) reasons.push(`${inboundLinks} backlinks`)

      return { note, score, matchReason: reasons.join(', ') || 'low relevance' }
    })

    return ranked
      .filter(r => r.score >= MIN_RECALL_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
  }

  // Search by tag
  searchByTag(tag: string): BrainNote[] {
    const index = this.loadIndex()
    const noteIds = index.tags[tag] || []
    return noteIds.map(id => this.getNoteById(id)).filter((n): n is BrainNote => n !== undefined)
  }

  // Search by category
  searchByCategory(category: PARACategory): BrainNote[] {
    const dir = join(this.baseDir, category)
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => this.readNoteFile(join(dir, f)))
      .filter((n): n is BrainNote => n !== undefined)
  }

  // Get note by ID (searches all categories)
  getNoteById(id: string): BrainNote | undefined {
    const index = this.loadIndex()
    const meta = index.notes[id]
    if (!meta) return undefined
    return this.readNoteFile(join(this.baseDir, meta.category, `${id}.md`))
  }

  // Get all notes
  getAllNotes(): BrainNote[] {
    const notes: BrainNote[] = []
    for (const cat of ['projects', 'areas', 'resources', 'archives'] as PARACategory[]) {
      const dir = join(this.baseDir, cat)
      if (!existsSync(dir)) continue
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.md')) continue
        const note = this.readNoteFile(join(dir, f))
        if (note) notes.push(note)
      }
    }
    return notes
  }

  // Get stats
  getStats(): { total: number; byCategory: Record<string, number>; totalTags: number; totalLinks: number } {
    const index = this.loadIndex()
    const byCategory: Record<string, number> = { projects: 0, areas: 0, resources: 0, archives: 0 }
    for (const meta of Object.values(index.notes)) {
      byCategory[meta.category] = (byCategory[meta.category] || 0) + 1
    }
    return {
      total: Object.keys(index.notes).length,
      byCategory,
      totalTags: Object.keys(index.tags).length,
      totalLinks: Object.values(index.backlinks).reduce((sum, ids) => sum + ids.length, 0),
    }
  }

  // Build prompt section from ranked notes
  buildPromptSection(query: string): string {
    const recalled = this.recall(query)
    if (recalled.length === 0) return ''

    const sections = recalled.map(r => {
      const meta = `[${r.note.category}] ${r.note.title} (score: ${r.score.toFixed(2)}, ${r.matchReason})`
      return `### ${meta}\n${r.note.content.slice(0, 500)}`
    })

    return [
      '# Second Brain — Relevant Knowledge',
      '',
      ...sections,
    ].join('\n\n')
  }

  private loadIndex(): BrainIndex {
    const indexPath = join(this.baseDir, '_index.json')
    if (!existsSync(indexPath)) return { notes: {}, backlinks: {}, tags: {} }
    try {
      return JSON.parse(readFileSync(indexPath, 'utf-8'))
    } catch {
      return { notes: {}, backlinks: {}, tags: {} }
    }
  }

  private readNoteFile(path: string): BrainNote | undefined {
    if (!existsSync(path)) return undefined
    const raw = readFileSync(path, 'utf-8')
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) return undefined

    const fm = match[1]
    const content = match[2].trim()

    const getField = (name: string): string => {
      const m = fm.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))
      return m ? m[1].trim() : ''
    }
    const getArray = (name: string): string[] => {
      const val = getField(name)
      if (!val || val === '[]') return []
      return val.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean)
    }

    const id = getField('id') || path.split('/').pop()?.replace('.md', '') || ''
    const category = getField('category') as PARACategory || 'resources'

    return {
      id, title: getField('title') || id, content, category,
      tags: getArray('tags'), links: getArray('links'),
      createdAt: new Date(getField('created') || Date.now()).getTime(),
      updatedAt: new Date(getField('updated') || Date.now()).getTime(),
      source: getField('source') || undefined,
    }
  }
}
