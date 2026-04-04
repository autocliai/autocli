import { describe, test, expect } from 'bun:test'
import { tasksCommand } from '../../src/cli/commands/tasks.js'
import { makeContext } from './helpers.js'

describe('tasks command', () => {
  test('returns list_bg_tasks type', async () => {
    const result = await tasksCommand.execute('', makeContext())
    expect(result.type).toBe('list_bg_tasks')
  })

  test('has correct name', () => {
    expect(tasksCommand.name).toBe('tasks')
  })
})
