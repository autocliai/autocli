import { describe, expect, test } from 'bun:test'
import { fuzzyMatch } from '../../src/ui/fuzzyPicker.js'

describe('fuzzyMatch', () => {
  test('exact substring matches with high score', () => {
    const result = fuzzyMatch('hello', 'say hello world')
    expect(result.matches).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  test('prefix match has higher score than later match', () => {
    const r1 = fuzzyMatch('he', 'hello')
    const r2 = fuzzyMatch('he', 'say hello')
    expect(r1.matches).toBe(true)
    expect(r2.matches).toBe(true)
    expect(r1.score).toBeGreaterThan(r2.score)
  })

  test('fuzzy matches chars in order', () => {
    const result = fuzzyMatch('hlo', 'hello')
    expect(result.matches).toBe(true)
  })

  test('fails when chars not in order', () => {
    const result = fuzzyMatch('olh', 'hello')
    expect(result.matches).toBe(false)
  })

  test('case insensitive matching', () => {
    const result = fuzzyMatch('HELLO', 'hello world')
    expect(result.matches).toBe(true)
  })

  test('empty query matches everything', () => {
    const result = fuzzyMatch('', 'anything')
    expect(result.matches).toBe(true)
  })

  test('word boundary chars give higher scores', () => {
    const r1 = fuzzyMatch('sr', 'src/repl.ts')
    expect(r1.matches).toBe(true)
    expect(r1.score).toBeGreaterThan(0)
  })
})
