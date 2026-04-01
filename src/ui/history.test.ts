import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { InputHistory } from './history.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let tmpDir: string
let histPath: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'hist-test-'))
  histPath = join(tmpDir, 'history.txt')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('InputHistory', () => {
  it('adds and retrieves entries', () => {
    const h = new InputHistory(histPath)
    h.add('first')
    h.add('second')
    expect(h.getEntries()).toEqual(['first', 'second'])
  })

  it('ignores empty/whitespace entries', () => {
    const h = new InputHistory(histPath)
    h.add('')
    h.add('   ')
    expect(h.getEntries()).toEqual([])
  })

  it('deduplicates entries', () => {
    const h = new InputHistory(histPath)
    h.add('hello')
    h.add('world')
    h.add('hello')
    expect(h.getEntries()).toEqual(['world', 'hello'])
  })

  it('navigates with previous/next', () => {
    const h = new InputHistory(histPath)
    h.add('first')
    h.add('second')
    h.add('third')
    expect(h.previous('current')).toBe('third')
    expect(h.previous('current')).toBe('second')
    expect(h.previous('current')).toBe('first')
    // At beginning, stays at first
    expect(h.previous('current')).toBe('first')
  })

  it('next returns empty at end', () => {
    const h = new InputHistory(histPath)
    h.add('first')
    h.add('second')
    h.previous('cur')
    h.previous('cur')
    expect(h.next('cur')).toBe('second')
    expect(h.next('cur')).toBe('')
  })

  it('previous returns current when empty', () => {
    const h = new InputHistory(histPath)
    expect(h.previous('fallback')).toBe('fallback')
  })

  it('reset moves index to end', () => {
    const h = new InputHistory(histPath)
    h.add('a')
    h.add('b')
    h.previous('c')
    h.reset()
    expect(h.previous('c')).toBe('b')
  })

  it('persists to disk', () => {
    const h1 = new InputHistory(histPath)
    h1.add('saved')
    const h2 = new InputHistory(histPath)
    expect(h2.getEntries()).toEqual(['saved'])
  })

  it('getEntries returns a copy', () => {
    const h = new InputHistory(histPath)
    h.add('item')
    const entries = h.getEntries()
    entries.push('modified')
    expect(h.getEntries()).toEqual(['item'])
  })
})
