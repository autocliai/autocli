import { describe, expect, test, afterAll } from 'bun:test'
import { MemoryManager } from '../../src/memory/memoryManager.js'
import { rmSync } from 'fs'

const TMP = '/tmp/mini-claude-test-memory'

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('MemoryManager', () => {
  test('saves and retrieves a memory', () => {
    const mm = new MemoryManager(TMP)
    mm.save({
      name: 'test-memory',
      description: 'A test memory',
      type: 'user',
      content: 'User likes TypeScript',
      filePath: '',
    })

    const retrieved = mm.get('test-memory')
    expect(retrieved).toBeDefined()
    expect(retrieved!.content).toBe('User likes TypeScript')
  })

  test('lists all memories', () => {
    const mm = new MemoryManager(TMP)
    const list = mm.list()
    expect(list.length).toBeGreaterThanOrEqual(1)
  })

  test('searches memories by keyword', () => {
    const mm = new MemoryManager(TMP)
    const results = mm.search('TypeScript')
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  test('deletes a memory', () => {
    const mm = new MemoryManager(TMP)
    mm.delete('test-memory')
    expect(mm.get('test-memory')).toBeUndefined()
  })

  test('loads index', () => {
    const mm = new MemoryManager(TMP)
    mm.save({
      name: 'indexed',
      description: 'indexed memory',
      type: 'project',
      content: 'project info',
      filePath: '',
    })
    const index = mm.getIndex()
    expect(index).toContain('indexed')
  })
})
