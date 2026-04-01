import { describe, expect, test } from 'bun:test'
import { completeCommand } from '../../src/ui/input.js'

describe('completeCommand', () => {
  const commands = ['help', 'cost', 'commit', 'compact', 'diff', 'exit']

  test('completes unique prefix', () => {
    expect(completeCommand('/he', commands)).toBe('/help')
  })

  test('completes common prefix for ambiguous input', () => {
    const result = completeCommand('/co', commands)
    expect(result).toBe('/co')
  })

  test('returns input unchanged if no match', () => {
    expect(completeCommand('/xyz', commands)).toBe('/xyz')
  })

  test('returns input for non-command text', () => {
    expect(completeCommand('hello', commands)).toBe('hello')
  })

  test('completes full match exactly', () => {
    expect(completeCommand('/help', commands)).toBe('/help')
  })
})
