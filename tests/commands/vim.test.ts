import { describe, expect, test } from 'bun:test'
import { vimCommand } from '../../src/commands/vim.js'

describe('vim command', () => {
  test('has correct name and description', () => {
    expect(vimCommand.name).toBe('vim')
    expect(vimCommand.description).toContain('vim')
  })

  test('returns vim_toggle result', async () => {
    const result = await vimCommand.run([], {
      workingDir: '/tmp',
      sessionId: 'test',
      messages: [],
      totalCost: 0,
      totalTokens: { input: 0, output: 0 },
    })
    expect(result).toEqual({ type: 'vim_toggle' })
  })
})
