import { describe, test, expect } from 'bun:test'
import { planCommand } from '../../src/cli/commands/plan.js'
import { makeContext } from './helpers.js'

describe('plan command', () => {
  test('returns plan_toggle type', async () => {
    const result = await planCommand.execute('', makeContext())
    expect(result.type).toBe('plan_toggle')
  })

  test('has correct name', () => {
    expect(planCommand.name).toBe('plan')
  })
})
