import { describe, it, expect } from 'bun:test'
import { highlightCode } from './syntaxHighlight.js'

describe('highlightCode', () => {
  it('returns a string', () => {
    expect(typeof highlightCode('const x = 1')).toBe('string')
  })

  it('preserves code content', () => {
    const result = highlightCode('const x = 1')
    expect(result).toContain('const')
    expect(result).toContain('x')
  })

  it('handles empty code', () => {
    expect(highlightCode('')).toBe('')
  })

  it('preserves string literals', () => {
    const result = highlightCode('const s = "hello world"')
    expect(result).toContain('hello world')
  })

  it('preserves single-line comments', () => {
    const result = highlightCode('// this is a comment')
    expect(result).toContain('this is a comment')
  })

  it('preserves multi-line comments', () => {
    const result = highlightCode('/* block comment */')
    expect(result).toContain('block comment')
  })

  it('handles hash comments for python', () => {
    const result = highlightCode('# python comment', 'python')
    expect(result).toContain('python comment')
  })

  it('preserves template literals', () => {
    const result = highlightCode('const s = `hello ${name}`')
    expect(result).toContain('hello')
  })

  it('handles multiline code', () => {
    const code = 'function foo() {\n  return 42\n}'
    const result = highlightCode(code)
    expect(result).toContain('function')
    expect(result).toContain('return')
    expect(result).toContain('42')
  })

  it('does not treat # as comment for non-hash languages', () => {
    const result = highlightCode('#selector { color: red }', 'css')
    // Should not dim the entire line as a comment
    expect(result).toContain('color')
  })
})
