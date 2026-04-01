import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { BrainWriter } from './writer.js'
import { BrainReader } from './reader.js'
import { BrainDistiller } from './distiller.js'

let tmpDir: string
let writer: BrainWriter
let reader: BrainReader
let distiller: BrainDistiller

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'test-distiller-'))
  writer = new BrainWriter(tmpDir)
  reader = new BrainReader(tmpDir)
  distiller = new BrainDistiller(reader, writer)
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('BrainDistiller', () => {
  describe('deduplicate()', () => {
    it('removes the older note when two notes have near-identical content', () => {
      writer.write('Note A', 'the quick brown fox jumps over the lazy dog repeatedly', 'resources')
      writer.write('Note B', 'the quick brown fox jumps over the lazy dog repeatedly today', 'resources')

      const result = distiller.deduplicate()

      expect(result.removed).toBe(1)
      expect(result.kept).toBe(1)

      // One of the two should have been removed
      const remaining = reader.getAllNotes()
      expect(remaining.length).toBe(1)
    })

    it('removes nothing when notes have unique content', () => {
      writer.write('Alpha', 'apples bananas cherries and dates for breakfast', 'resources')
      writer.write('Beta', 'kubernetes docker containers orchestration deployment pipeline', 'areas')

      const result = distiller.deduplicate()

      expect(result.removed).toBe(0)
      expect(result.kept).toBe(2)
      expect(reader.getAllNotes().length).toBe(2)
    })

    it('returns correct removed and kept counts', () => {
      writer.write('Dup 1', 'exactly the same long content string for dedup testing purposes here', 'resources')
      writer.write('Dup 2', 'exactly the same long content string for dedup testing purposes here', 'areas')
      writer.write('Unique', 'completely different unrelated content about quantum physics and math', 'projects')

      const result = distiller.deduplicate()

      expect(result.removed).toBe(1)
      expect(result.kept).toBe(2)
    })
  })

  describe('archiveOldProjects()', () => {
    it('archives notes older than cutoff; fresh notes stay', () => {
      writer.write('Old Project', 'some project content here for testing', 'projects')
      writer.write('Area Note', 'area content should not be affected', 'areas')

      const archived = distiller.archiveOldProjects(0)

      expect(archived).toBe(1)

      const projects = reader.searchByCategory('projects')
      expect(projects.length).toBe(0)

      const archives = reader.searchByCategory('archives')
      expect(archives.some(n => n.title === 'Old Project')).toBe(true)

      const areas = reader.searchByCategory('areas')
      expect(areas.length).toBe(1)
    })

    it('returns 0 when no project notes exist', () => {
      writer.write('Area Note', 'area content', 'areas')
      const archived = distiller.archiveOldProjects(0)
      expect(archived).toBe(0)
    })
  })

  describe('generateSummary()', () => {
    it('returns string containing note titles, categories, and stats', () => {
      writer.write('Project Alpha', 'working on #typescript compiler', 'projects')
      writer.write('Server Setup', 'nginx configuration and deployment', 'areas', { tags: ['devops'] })

      const summary = distiller.generateSummary()

      expect(summary).toContain('Brain Summary')
      expect(summary).toContain('2 notes')
      expect(summary).toContain('Project Alpha')
      expect(summary).toContain('Server Setup')
      expect(summary).toContain('Projects')
      expect(summary).toContain('Areas')
    })

    it('returns summary with zero notes', () => {
      const summary = distiller.generateSummary()
      expect(summary).toContain('Brain Summary')
      expect(summary).toContain('0 notes')
    })
  })
})
