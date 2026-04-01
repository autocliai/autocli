import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { MemoryManager } from './memoryManager.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let tmpDir: string
let mgr: MemoryManager

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'memory-test-'))
  mgr = new MemoryManager(tmpDir)
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

const entry = (name: string, type: 'user' | 'feedback' | 'project' | 'reference' = 'user') => ({
  name,
  description: `Description of ${name}`,
  type,
  content: `Content for ${name}`,
  filePath: '',
})

describe('MemoryManager', () => {
  describe('save + get', () => {
    it('saves and retrieves an entry', () => {
      mgr.save(entry('test-memory'))
      const result = mgr.get('test-memory')
      expect(result).toBeDefined()
      expect(result!.name).toBe('test-memory')
      expect(result!.content).toBe('Content for test-memory')
      expect(result!.type).toBe('user')
    })

    it('returns undefined for missing entry', () => {
      expect(mgr.get('nonexistent')).toBeUndefined()
    })
  })

  describe('list', () => {
    it('returns all entries', () => {
      mgr.save(entry('one'))
      mgr.save(entry('two'))
      const list = mgr.list()
      expect(list.length).toBe(2)
    })

    it('returns empty when no entries', () => {
      expect(mgr.list()).toEqual([])
    })
  })

  describe('search', () => {
    it('searches by name', () => {
      mgr.save(entry('user-role'))
      mgr.save(entry('project-goal'))
      const results = mgr.search('user')
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('user-role')
    })

    it('searches case-insensitively', () => {
      mgr.save(entry('TestCase'))
      expect(mgr.search('testcase').length).toBe(1)
    })

    it('searches in content', () => {
      const e = entry('mem')
      e.content = 'The user prefers TypeScript'
      mgr.save(e)
      expect(mgr.search('TypeScript').length).toBe(1)
    })

    it('returns empty for no matches', () => {
      mgr.save(entry('something'))
      expect(mgr.search('zzzzz')).toEqual([])
    })
  })

  describe('delete', () => {
    it('removes an entry', () => {
      mgr.save(entry('to-delete'))
      mgr.delete('to-delete')
      expect(mgr.get('to-delete')).toBeUndefined()
    })

    it('updates index after delete', () => {
      mgr.save(entry('keep'))
      mgr.save(entry('remove'))
      mgr.delete('remove')
      const index = mgr.getIndex()
      expect(index).not.toContain('remove')
      expect(index).toContain('keep')
    })
  })

  describe('getIndex', () => {
    it('returns empty string when no entries', () => {
      expect(mgr.getIndex()).toBe('')
    })

    it('returns index content after saves', () => {
      mgr.save(entry('my-entry'))
      const index = mgr.getIndex()
      expect(index).toContain('my-entry')
    })
  })

  describe('loadForPrompt', () => {
    it('returns empty for no memories', () => {
      expect(mgr.loadForPrompt()).toBe('')
    })

    it('returns formatted section with header', () => {
      mgr.save(entry('test'))
      const prompt = mgr.loadForPrompt()
      expect(prompt).toContain('Auto Memory')
      expect(prompt).toContain('MEMORY.md')
    })
  })

  describe('file name sanitization', () => {
    it('sanitizes special characters', () => {
      mgr.save(entry('hello world!@#'))
      const result = mgr.get('hello world!@#')
      expect(result).toBeDefined()
    })
  })

  describe('entry types', () => {
    it('handles all memory types', () => {
      for (const type of ['user', 'feedback', 'project', 'reference'] as const) {
        mgr.save(entry(`${type}-test`, type))
        const result = mgr.get(`${type}-test`)
        expect(result!.type).toBe(type)
      }
    })
  })
})
