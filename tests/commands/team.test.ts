import { describe, test, expect } from 'bun:test'
import { teamCommand } from '../../src/cli/commands/team.js'
import { makeContext } from './helpers.js'

describe('team command', () => {
  test('returns team_status type by default', async () => {
    const result = await teamCommand.execute('', makeContext())
    expect(result.type).toBe('team_status')
  })

  test('returns team_save with name', async () => {
    const result = await teamCommand.execute('save my-team', makeContext())
    expect(result.type).toBe('team_save')
    expect((result as any).saveName).toBe('my-team')
  })

  test('returns error for save without name', async () => {
    const result = await teamCommand.execute('save', makeContext())
    expect(result.output).toContain('Usage')
  })
})
