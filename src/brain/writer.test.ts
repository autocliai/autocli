import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { BrainWriter } from './writer.js'

let tmpDir: string
let writer: BrainWriter

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'test-writer-'))
  writer = new BrainWriter(tmpDir)
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('BrainWriter', () => {
  describe('constructor', () => {
    it('creates PARA directories', () => {
      expect(existsSync(join(tmpDir, 'projects'))).toBe(true)
      expect(existsSync(join(tmpDir, 'areas'))).toBe(true)
      expect(existsSync(join(tmpDir, 'resources'))).toBe(true)
      expect(existsSync(join(tmpDir, 'archives'))).toBe(true)
    })
  })

  describe('write()', () => {
    it('returns BrainNote with correct id (lowercased, hyphenated)', () => {
      const note = writer.write('My Cool Note', 'content', 'resources')
      expect(note.id).toBe('my-cool-note')
    })

    it('generates id: "My Cool Note" becomes "my-cool-note"', () => {
      const note = writer.write('My Cool Note', 'content', 'resources')
      expect(note.id).toBe('my-cool-note')
    })

    it('strips leading/trailing hyphens from id', () => {
      const note = writer.write('--Weird Title--', 'content', 'resources')
      expect(note.id).toBe('weird-title')
    })

    it('creates markdown file with frontmatter', () => {
      writer.write('Test Note', 'some content', 'projects')
      const filePath = join(tmpDir, 'projects', 'test-note.md')
      expect(existsSync(filePath)).toBe(true)

      const raw = readFileSync(filePath, 'utf-8')
      expect(raw).toContain('---')
      expect(raw).toContain('id: test-note')
      expect(raw).toContain('title: Test Note')
      expect(raw).toContain('category: projects')
      expect(raw).toContain('some content')
    })

    it('extracts [[wiki-links]] from content into links', () => {
      const note = writer.write('Links Test', 'See [[other-note]] and [[another]]', 'resources')
      expect(note.links).toContain('other-note')
      expect(note.links).toContain('another')
    })

    it('extracts #tags from content into tags', () => {
      const note = writer.write('Tags Test', 'Working on #typescript and #rust', 'resources')
      expect(note.tags).toContain('typescript')
      expect(note.tags).toContain('rust')
    })

    it('deduplicates tags', () => {
      const note = writer.write('Dup Tags', 'Uses #typescript heavily', 'resources', { tags: ['typescript'] })
      const tsCount = note.tags.filter(t => t === 'typescript').length
      expect(tsCount).toBe(1)
    })

    it('updates index file (_index.json)', () => {
      writer.write('Indexed Note', 'content', 'areas')
      const indexPath = join(tmpDir, '_index.json')
      expect(existsSync(indexPath)).toBe(true)

      const index = JSON.parse(readFileSync(indexPath, 'utf-8'))
      expect(index.notes['indexed-note']).toBeDefined()
      expect(index.notes['indexed-note'].title).toBe('Indexed Note')
      expect(index.notes['indexed-note'].category).toBe('areas')
    })

    it('writing same title twice updates note and preserves createdAt', () => {
      const first = writer.write('Same Title', 'first content', 'resources')
      const createdAt = first.createdAt

      const second = writer.write('Same Title', 'second content', 'resources')

      expect(second.id).toBe(first.id)
      expect(second.createdAt).toBe(createdAt)
      expect(second.content).toBe('second content')
    })
  })

  describe('delete()', () => {
    it('removes file and updates index', () => {
      writer.write('To Delete', 'bye', 'resources')
      const filePath = join(tmpDir, 'resources', 'to-delete.md')
      expect(existsSync(filePath)).toBe(true)

      const result = writer.delete('resources', 'to-delete')
      expect(result).toBe(true)
      expect(existsSync(filePath)).toBe(false)

      const index = writer.loadIndex()
      expect(index.notes['to-delete']).toBeUndefined()
    })

    it('returns false for missing note', () => {
      const result = writer.delete('resources', 'nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('archive()', () => {
    it('moves note from original category to archives', () => {
      writer.write('Archivable', 'project content', 'projects')
      const archived = writer.archive('archivable')

      expect(archived).toBeDefined()
      expect(archived!.category).toBe('archives')

      expect(existsSync(join(tmpDir, 'projects', 'archivable.md'))).toBe(false)
      expect(existsSync(join(tmpDir, 'archives', 'archivable.md'))).toBe(true)
    })

    it('returns undefined for nonexistent note', () => {
      const result = writer.archive('nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('loadIndex()', () => {
    it('returns correct BrainIndex structure', () => {
      const index = writer.loadIndex()
      expect(index).toHaveProperty('notes')
      expect(index).toHaveProperty('backlinks')
      expect(index).toHaveProperty('tags')
    })

    it('returns populated index after writes', () => {
      writer.write('Note A', 'content with #tag1 and [[note-b]]', 'resources')
      writer.write('Note B', 'other content #tag2', 'areas')

      const index = writer.loadIndex()
      expect(Object.keys(index.notes).length).toBe(2)
      expect(index.tags['tag1']).toContain('note-a')
      expect(index.backlinks['note-b']).toContain('note-a')
    })
  })
})
