import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { loadClaudeMdFiles } from '../../src/memory/claudeMd.js'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

const TMP = '/tmp/mini-claude-test-claudemd'

beforeAll(() => {
  mkdirSync(join(TMP, '.claude'), { recursive: true })
  writeFileSync(join(TMP, 'CLAUDE.md'), '# Project Rules\nAlways use TypeScript.')
  writeFileSync(join(TMP, '.claude', 'CLAUDE.md'), '# Claude Config\nPrefer functional style.')
})

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('loadClaudeMdFiles', () => {
  test('loads CLAUDE.md from project root', () => {
    const content = loadClaudeMdFiles(TMP)
    expect(content).toContain('Always use TypeScript')
  })

  test('loads .claude/CLAUDE.md', () => {
    const content = loadClaudeMdFiles(TMP)
    expect(content).toContain('Prefer functional style')
  })

  test('returns empty for directory with no CLAUDE.md', () => {
    const content = loadClaudeMdFiles('/tmp')
    expect(content).toBe('')
  })
})
