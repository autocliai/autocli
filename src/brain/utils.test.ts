import { describe, it, expect } from 'bun:test'
import { jaccardSimilarity, tokenize, recencyScore, isDuplicate, extractLinks, extractTags } from './utils.js'

describe('tokenize', () => {
  it('lowercases and splits on whitespace', () => {
    const tokens = tokenize('Hello World Foo')
    expect(tokens.has('hello')).toBe(true)
    expect(tokens.has('world')).toBe(true)
    expect(tokens.has('foo')).toBe(true)
  })

  it('filters tokens with length <= 2', () => {
    const tokens = tokenize('I am a big dog')
    expect(tokens.has('i')).toBe(false)
    expect(tokens.has('am')).toBe(false)
    expect(tokens.has('big')).toBe(true)
    expect(tokens.has('dog')).toBe(true)
  })

  it('replaces non-alphanumeric with spaces', () => {
    const tokens = tokenize('hello-world foo_bar')
    expect(tokens.has('hello')).toBe(true)
    expect(tokens.has('world')).toBe(true)
    expect(tokens.has('foo')).toBe(true)
    expect(tokens.has('bar')).toBe(true)
  })

  it('returns empty set for empty string', () => {
    expect(tokenize('').size).toBe(0)
  })

  it('returns empty set for short words only', () => {
    expect(tokenize('a b c').size).toBe(0)
  })
})

describe('jaccardSimilarity', () => {
  it('returns 0 for two empty strings', () => {
    expect(jaccardSimilarity('', '')).toBe(0)
  })

  it('returns 1 for identical strings', () => {
    expect(jaccardSimilarity('hello world foo', 'hello world foo')).toBe(1)
  })

  it('returns 0 for completely different strings', () => {
    expect(jaccardSimilarity('alpha beta gamma', 'delta epsilon zeta')).toBe(0)
  })

  it('returns a fraction for partial overlap', () => {
    const score = jaccardSimilarity('hello world foo', 'hello world bar')
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })

  it('is symmetric', () => {
    const a = 'hello world foo'
    const b = 'world bar baz'
    expect(jaccardSimilarity(a, b)).toBe(jaccardSimilarity(b, a))
  })
})

describe('recencyScore', () => {
  it('returns ~1 for now', () => {
    const score = recencyScore(Date.now())
    expect(score).toBeGreaterThan(0.99)
  })

  it('returns smaller score for older dates', () => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const score = recencyScore(oneWeekAgo)
    expect(score).toBeLessThan(0.2)
    expect(score).toBeGreaterThan(0)
  })

  it('returns very small score for very old dates', () => {
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
    const score = recencyScore(oneYearAgo)
    expect(score).toBeLessThan(0.01)
  })
})

describe('isDuplicate', () => {
  it('returns true for identical content', () => {
    expect(isDuplicate('hello world foo bar', 'hello world foo bar')).toBe(true)
  })

  it('returns false for very different content', () => {
    expect(isDuplicate('alpha beta gamma', 'delta epsilon zeta')).toBe(false)
  })

  it('respects custom threshold', () => {
    const a = 'hello world foo'
    const b = 'hello world bar'
    expect(isDuplicate(a, b, 0.3)).toBe(true)
    expect(isDuplicate(a, b, 0.9)).toBe(false)
  })
})

describe('extractLinks', () => {
  it('extracts wiki-style links', () => {
    const links = extractLinks('See [[my note]] and [[another note]]')
    expect(links).toEqual(['my note', 'another note'])
  })

  it('returns empty array when no links', () => {
    expect(extractLinks('no links here')).toEqual([])
  })

  it('trims whitespace from link text', () => {
    const links = extractLinks('[[  spaced  ]]')
    expect(links).toEqual(['spaced'])
  })
})

describe('extractTags', () => {
  it('extracts hash tags', () => {
    const tags = extractTags('Hello #world and #foo-bar')
    expect(tags).toEqual(['world', 'foo-bar'])
  })

  it('returns empty array when no tags', () => {
    expect(extractTags('no tags here')).toEqual([])
  })

  it('handles underscores in tags', () => {
    const tags = extractTags('#my_tag')
    expect(tags).toEqual(['my_tag'])
  })
})
