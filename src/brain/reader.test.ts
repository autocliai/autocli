import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { BrainWriter } from './writer.js'
import { BrainReader } from './reader.js'

let tmpDir: string
let writer: BrainWriter
let reader: BrainReader

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'test-reader-'))
  writer = new BrainWriter(tmpDir)
  reader = new BrainReader(tmpDir)
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('BrainReader', () => {
  describe('getAllNotes()', () => {
    it('returns all notes across categories', () => {
      writer.write('Project Note', 'project content', 'projects')
      writer.write('Area Note', 'area content', 'areas')
      writer.write('Resource Note', 'resource content', 'resources')

      const all = reader.getAllNotes()
      expect(all.length).toBe(3)

      const ids = all.map(n => n.id)
      expect(ids).toContain('project-note')
      expect(ids).toContain('area-note')
      expect(ids).toContain('resource-note')
    })

    it('returns empty array when no notes exist', () => {
      expect(reader.getAllNotes().length).toBe(0)
    })
  })

  describe('getNoteById()', () => {
    it('returns the note by id', () => {
      writer.write('Find Me', 'content here', 'resources')
      const note = reader.getNoteById('find-me')
      expect(note).toBeDefined()
      expect(note!.title).toBe('Find Me')
      expect(note!.content).toBe('content here')
    })

    it('returns undefined for missing id', () => {
      expect(reader.getNoteById('nonexistent')).toBeUndefined()
    })
  })

  describe('searchByCategory()', () => {
    it('returns notes in that category only', () => {
      writer.write('P1', 'proj content', 'projects')
      writer.write('P2', 'proj content two', 'projects')
      writer.write('A1', 'area content', 'areas')

      const projects = reader.searchByCategory('projects')
      expect(projects.length).toBe(2)
      expect(projects.every(n => n.category === 'projects')).toBe(true)

      const areas = reader.searchByCategory('areas')
      expect(areas.length).toBe(1)
    })

    it('returns empty array for empty category', () => {
      expect(reader.searchByCategory('archives').length).toBe(0)
    })
  })

  describe('searchByTag()', () => {
    it('returns notes with that tag', () => {
      writer.write('Tagged', 'content with #important stuff', 'resources')
      writer.write('Not Tagged', 'plain content', 'resources')

      const results = reader.searchByTag('important')
      expect(results.length).toBe(1)
      expect(results[0].id).toBe('tagged')
    })

    it('returns empty array for unknown tag', () => {
      expect(reader.searchByTag('nonexistent').length).toBe(0)
    })
  })

  describe('recall()', () => {
    it('returns ranked notes sorted by score descending', () => {
      writer.write('TypeScript Guide', 'typescript generics interfaces types compiler', 'resources')
      writer.write('Cooking Recipes', 'pasta sauce tomatoes basil garlic olive oil', 'areas')

      const results = reader.recall('typescript generics interfaces')
      expect(results.length).toBeGreaterThanOrEqual(1)

      expect(results[0].note.id).toBe('typescript-guide')

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })

    it('filters results by MIN_RECALL_SCORE (0.1)', () => {
      writer.write('Unrelated', 'xylophone zebra quantum entanglement', 'resources')

      const results = reader.recall('completely unmatched query about nothing specific')
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0.1)
      }
    })

    it('respects maxResults', () => {
      writer.write('Note 1', 'test content alpha', 'resources')
      writer.write('Note 2', 'test content beta', 'resources')
      writer.write('Note 3', 'test content gamma', 'resources')

      const results = reader.recall('test content', 1)
      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('returns empty array when no notes exist', () => {
      const results = reader.recall('anything')
      expect(results.length).toBe(0)
    })
  })

  describe('getStats()', () => {
    it('returns correct total, byCategory counts, totalTags, totalLinks', () => {
      writer.write('P1', 'project with #tag1 and [[linked-note]]', 'projects')
      writer.write('A1', 'area with #tag2', 'areas')
      writer.write('R1', 'resource plain', 'resources')

      const stats = reader.getStats()
      expect(stats.total).toBe(3)
      expect(stats.byCategory.projects).toBe(1)
      expect(stats.byCategory.areas).toBe(1)
      expect(stats.byCategory.resources).toBe(1)
      expect(stats.byCategory.archives).toBe(0)
      expect(stats.totalTags).toBe(2)
    })

    it('returns zeros when empty', () => {
      const stats = reader.getStats()
      expect(stats.total).toBe(0)
      expect(stats.totalTags).toBe(0)
      expect(stats.totalLinks).toBe(0)
    })
  })

  describe('buildPromptSection()', () => {
    it('returns formatted string with headers when matches exist', () => {
      writer.write('Relevant Note', 'typescript compiler internals and type checking', 'resources')

      const section = reader.buildPromptSection('typescript compiler')
      expect(section).toContain('Second Brain')
      expect(section).toContain('Relevant Note')
      expect(section).toContain('resources')
    })

    it('returns empty string when no matches', () => {
      const section = reader.buildPromptSection('xyznonexistentquery123')
      expect(section).toBe('')
    })
  })
})
