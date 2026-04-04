import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { agentsCommand } from '../../src/cli/commands/agents.js'
import { setupTestDb, teardownTestDb, makeContext } from './helpers.js'

describe('agents command', () => {
  beforeAll(() => setupTestDb())
  afterAll(() => teardownTestDb())

  test('list shows no agents initially', async () => {
    const result = await agentsCommand.execute('list', makeContext())
    expect(result.output).toContain('No agents defined')
  })

  test('defaults to list subcommand', async () => {
    const result = await agentsCommand.execute('', makeContext())
    expect(result.output).toContain('Agents')
  })

  test('create without name returns error', async () => {
    const result = await agentsCommand.execute('create', makeContext())
    expect(result.output).toContain('Usage')
  })

  test('create agent succeeds', async () => {
    const result = await agentsCommand.execute('create test-agent', makeContext())
    expect(result.output).toContain('Agent created')
    expect(result.output).toContain('test-agent')
  })

  test('create duplicate agent returns error', async () => {
    const result = await agentsCommand.execute('create test-agent', makeContext())
    expect(result.output).toContain('already exists')
  })

  test('list shows created agent', async () => {
    const result = await agentsCommand.execute('list', makeContext())
    expect(result.output).toContain('test-agent')
  })

  test('show agent returns details', async () => {
    const result = await agentsCommand.execute('show test-agent', makeContext())
    expect(result.output).toContain('test-agent')
    expect(result.output).toContain('general-purpose')
  })

  test('show without name returns error', async () => {
    const result = await agentsCommand.execute('show', makeContext())
    expect(result.output).toContain('Usage')
  })

  test('show nonexistent agent returns error', async () => {
    const result = await agentsCommand.execute('show nonexistent', makeContext())
    expect(result.output).toContain('not found')
  })

  test('delete without name returns error', async () => {
    const result = await agentsCommand.execute('delete', makeContext())
    expect(result.output).toContain('Usage')
  })

  test('delete nonexistent agent returns error', async () => {
    const result = await agentsCommand.execute('delete nonexistent', makeContext())
    expect(result.output).toContain('not found')
  })

  test('delete agent succeeds', async () => {
    const result = await agentsCommand.execute('delete test-agent', makeContext())
    expect(result.output).toContain('deleted')
  })

  test('list shows no agents after delete', async () => {
    const result = await agentsCommand.execute('list', makeContext())
    expect(result.output).toContain('No agents defined')
  })

  test('unknown subcommand returns error', async () => {
    const result = await agentsCommand.execute('badcmd', makeContext())
    expect(result.output).toContain('Unknown subcommand')
  })
})
