import { describe, test, expect } from 'bun:test'
import { helpCommand } from '../../src/cli/commands/help.js'
import { makeContext } from './helpers.js'

describe('help command', () => {
  test('returns output with command list', async () => {
    const result = await helpCommand.execute('', makeContext())
    expect(result.output).toBeDefined()
    expect(result.output).toContain('/help')
    expect(result.output).toContain('/review')
    expect(result.output).toContain('/brain')
    expect(result.output).toContain('/permissions')
    expect(result.output).toContain('/agents')
    expect(result.output).toContain('/schedule')
    expect(result.output).toContain('/deploy')
    expect(result.output).toContain('/status')
  })

  test('has correct name and aliases', () => {
    expect(helpCommand.name).toBe('help')
    expect(helpCommand.aliases).toContain('h')
    expect(helpCommand.aliases).toContain('?')
  })
})
