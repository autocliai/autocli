import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { brainCommand } from '../../src/cli/commands/brain.js'
import { setupTestDb, teardownTestDb, makeContext, getTmpDir } from './helpers.js'
import { mkdirSync } from 'fs'
import { join } from 'path'

// Brain command creates its own BrainStore from platform.configDir,
// so we test it via its output since it reads from the global brain dir.

describe('brain command', () => {
  beforeAll(() => setupTestDb())
  afterAll(() => teardownTestDb())

  test('stats subcommand returns stats output', async () => {
    const result = await brainCommand.execute('stats', makeContext())
    expect(result.output).toContain('Second Brain')
    expect(result.output).toContain('Total notes')
    expect(result.output).toContain('Projects')
    expect(result.output).toContain('Areas')
    expect(result.output).toContain('Resources')
    expect(result.output).toContain('Archives')
  })

  test('defaults to stats when no subcommand', async () => {
    const result = await brainCommand.execute('', makeContext())
    expect(result.output).toContain('Second Brain')
    expect(result.output).toContain('Total notes')
  })

  test('search without query returns usage', async () => {
    const result = await brainCommand.execute('search', makeContext())
    expect(result.output).toContain('Usage')
  })

  test('search with query returns results or no matches', async () => {
    const result = await brainCommand.execute('search nonexistent-topic', makeContext())
    expect(result.output).toBeDefined()
  })

  test('sync subcommand returns success', async () => {
    const result = await brainCommand.execute('sync', makeContext())
    expect(result.output).toContain('synced')
  })

  test('unknown subcommand returns usage', async () => {
    const result = await brainCommand.execute('invalid', makeContext())
    expect(result.output).toContain('Usage')
  })
})
