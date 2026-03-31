import { describe, expect, test, afterAll } from 'bun:test'
import { MemoryManager } from '../../src/memory/memoryManager.js'
import { rmSync } from 'fs'

const TMP = '/tmp/mini-claude-test-mem-prompt'

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('loadForPrompt', () => {
  test('returns empty string when no memories', () => {
    const mm = new MemoryManager(TMP + '/empty')
    expect(mm.loadForPrompt()).toBe('')
  })

  test('returns MEMORY.md content plus memory instructions', () => {
    const mm = new MemoryManager(TMP + '/with-data')
    mm.save({ name: 'test', description: 'a test', type: 'user', content: 'User is a dev', filePath: '' })
    const prompt = mm.loadForPrompt()
    expect(prompt).toContain('MEMORY.md')
    expect(prompt).toContain('test')
  })

  test('caps output at 200 lines', () => {
    const mm = new MemoryManager(TMP + '/overflow')
    for (let i = 0; i < 250; i++) {
      mm.save({ name: `mem-${i}`, description: `desc ${i}`, type: 'user', content: `content ${i}`, filePath: '' })
    }
    const prompt = mm.loadForPrompt()
    const lines = prompt.split('\n')
    expect(lines.length).toBeLessThanOrEqual(210)
  })
})
