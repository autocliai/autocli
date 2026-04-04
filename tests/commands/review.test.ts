import { describe, test, expect } from 'bun:test'
import { reviewCommand } from '../../src/cli/commands/review.js'
import { makeContext } from './helpers.js'

describe('review command', () => {
  test('returns prompt for default review', async () => {
    const result = await reviewCommand.execute('', makeContext())
    expect(result.type).toBe('prompt')
    expect(result.prompt).toContain('git diff')
    expect(result.prompt).toContain('bugs')
  })

  test('returns prompt for staged review', async () => {
    const result = await reviewCommand.execute('--staged', makeContext())
    expect(result.type).toBe('prompt')
    expect(result.prompt).toContain('staged')
    expect(result.prompt).toContain('git diff --cached')
  })

  test('returns prompt for -s alias', async () => {
    const result = await reviewCommand.execute('-s', makeContext())
    expect(result.type).toBe('prompt')
    expect(result.prompt).toContain('staged')
  })

  test('returns prompt for PR number', async () => {
    const result = await reviewCommand.execute('123', makeContext())
    expect(result.type).toBe('prompt')
    expect(result.prompt).toContain('#123')
  })

  test('has correct name and aliases', () => {
    expect(reviewCommand.name).toBe('review')
    expect(reviewCommand.aliases).toContain('cr')
  })
})
