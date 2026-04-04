import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { scheduleCommand } from '../../src/cli/commands/schedule.js'
import { setupTestDb, teardownTestDb, makeContext } from './helpers.js'

describe('schedule command', () => {
  beforeAll(() => setupTestDb())
  afterAll(() => teardownTestDb())

  test('list shows no schedules initially', async () => {
    const result = await scheduleCommand.execute('list', makeContext())
    expect(result.output).toContain('No schedules configured')
  })

  test('defaults to list subcommand', async () => {
    const result = await scheduleCommand.execute('', makeContext())
    expect(result.output).toContain('No schedules configured')
  })

  test('add without team name returns error', async () => {
    const result = await scheduleCommand.execute('add', makeContext())
    expect(result.output).toContain('Usage')
  })

  test('add without interval returns error', async () => {
    const result = await scheduleCommand.execute('add my-team', makeContext())
    expect(result.output).toContain('Usage')
  })

  test('add with non-numeric interval defaults to 1h', async () => {
    const result = await scheduleCommand.execute('add interval-team xyz', makeContext())
    // parseInterval defaults unrecognized input to 1h, so schedule is created
    expect(result.output).toContain('Schedule created')
  })

  test('add schedule succeeds', async () => {
    const result = await scheduleCommand.execute('add my-team 1h', makeContext())
    expect(result.output).toContain('Schedule created')
    expect(result.output).toContain('my-team')
    expect(result.output).toContain('1h')
  })

  test('list shows created schedule', async () => {
    const result = await scheduleCommand.execute('list', makeContext())
    expect(result.output).toContain('my-team')
    expect(result.output).toContain('1h')
  })

  test('disable without id returns error', async () => {
    const result = await scheduleCommand.execute('disable', makeContext())
    expect(result.output).toContain('Usage')
  })

  test('disable with invalid id returns error', async () => {
    const result = await scheduleCommand.execute('disable abc', makeContext())
    expect(result.output).toContain('Invalid schedule ID')
  })

  test('disable nonexistent id returns error', async () => {
    const result = await scheduleCommand.execute('disable 999', makeContext())
    expect(result.output).toContain('not found')
  })

  test('enable without id returns error', async () => {
    const result = await scheduleCommand.execute('enable', makeContext())
    expect(result.output).toContain('Usage')
  })

  test('remove without id returns error', async () => {
    const result = await scheduleCommand.execute('remove', makeContext())
    expect(result.output).toContain('Usage')
  })

  test('remove nonexistent id returns error', async () => {
    const result = await scheduleCommand.execute('remove 999', makeContext())
    expect(result.output).toContain('not found')
  })

  test('run without team returns error', async () => {
    const result = await scheduleCommand.execute('run', makeContext())
    expect(result.output).toContain('Usage')
  })

  test('run with team returns run_team type', async () => {
    const result = await scheduleCommand.execute('run my-team', makeContext())
    expect(result.type).toBe('run_team')
    expect((result as any).team).toBe('my-team')
  })

  test('results shows empty when no jobs', async () => {
    const result = await scheduleCommand.execute('results', makeContext())
    expect(result.output).toContain('No job results')
  })

  test('results with invalid id returns error', async () => {
    const result = await scheduleCommand.execute('results abc', makeContext())
    expect(result.output).toContain('Invalid job ID')
  })

  test('results with nonexistent id returns error', async () => {
    const result = await scheduleCommand.execute('results 999', makeContext())
    expect(result.output).toContain('not found')
  })

  test('results --schedule without id returns error', async () => {
    const result = await scheduleCommand.execute('results --schedule', makeContext())
    expect(result.output).toContain('Usage')
  })

  test('unknown subcommand returns error', async () => {
    const result = await scheduleCommand.execute('badcmd', makeContext())
    expect(result.output).toContain('Unknown subcommand')
  })
})
