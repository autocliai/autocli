import { describe, test, expect } from 'bun:test'
import { statusCommand } from '../../src/cli/commands/status.js'
import { makeContext } from './helpers.js'

describe('status command', () => {
  test('returns full_status type', async () => {
    const result = await statusCommand.execute('', makeContext())
    expect(result.type).toBe('full_status')
  })

  test('has correct name', () => {
    expect(statusCommand.name).toBe('status')
  })
})
