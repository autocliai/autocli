import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadClaudeMdFiles } from './claudeMd.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'test-claudemd-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('loadClaudeMdFiles', () => {
  it('returns content from CLAUDE.md in working dir', () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), 'Root instructions here')

    const result = loadClaudeMdFiles(tmpDir)
    expect(result).toContain('Root instructions here')
    expect(result).toContain('From CLAUDE.md')
  })

  it('returns content from .claude/CLAUDE.md', () => {
    mkdirSync(join(tmpDir, '.claude'), { recursive: true })
    writeFileSync(join(tmpDir, '.claude', 'CLAUDE.md'), 'Nested instructions')

    const result = loadClaudeMdFiles(tmpDir)
    expect(result).toContain('Nested instructions')
    expect(result).toContain('From .claude/CLAUDE.md')
  })

  it('concatenates both when both exist (with separator)', () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), 'Root content')
    mkdirSync(join(tmpDir, '.claude'), { recursive: true })
    writeFileSync(join(tmpDir, '.claude', 'CLAUDE.md'), 'Nested content')

    const result = loadClaudeMdFiles(tmpDir)
    expect(result).toContain('Root content')
    expect(result).toContain('Nested content')
    expect(result).toContain('---')
  })

  it('returns empty string when neither exists', () => {
    const result = loadClaudeMdFiles(tmpDir)
    expect(result).toBe('')
  })

  it('skips empty files', () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), '')
    mkdirSync(join(tmpDir, '.claude'), { recursive: true })
    writeFileSync(join(tmpDir, '.claude', 'CLAUDE.md'), '   ')

    const result = loadClaudeMdFiles(tmpDir)
    expect(result).toBe('')
  })
})
