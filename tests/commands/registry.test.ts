import { describe, test, expect } from 'bun:test'
import { CommandRegistry } from '../../src/cli/commands/registry.js'
import type { CommandDefinition } from '../../src/cli/commands/types.js'
import { makeContext } from './helpers.js'

const mockCommand: CommandDefinition = {
  name: 'test',
  description: 'A test command',
  aliases: ['t'],
  async execute(args) {
    return { output: `args: ${args}` }
  },
}

describe('CommandRegistry', () => {
  test('register and execute command', async () => {
    const registry = new CommandRegistry()
    registry.register(mockCommand)
    const result = await registry.execute('test hello', makeContext())
    expect(result).toBeDefined()
    expect(result!.output).toBe('args: hello')
  })

  test('execute by alias', async () => {
    const registry = new CommandRegistry()
    registry.register(mockCommand)
    const result = await registry.execute('t world', makeContext())
    expect(result).toBeDefined()
    expect(result!.output).toBe('args: world')
  })

  test('unknown command returns null', async () => {
    const registry = new CommandRegistry()
    const result = await registry.execute('unknown', makeContext())
    expect(result).toBeNull()
  })

  test('has checks registered commands', () => {
    const registry = new CommandRegistry()
    registry.register(mockCommand)
    expect(registry.has('test')).toBe(true)
    expect(registry.has('t')).toBe(true)
    expect(registry.has('nope')).toBe(false)
  })

  test('list returns unique commands', () => {
    const registry = new CommandRegistry()
    registry.register(mockCommand)
    const list = registry.list()
    expect(list.length).toBe(1)
    expect(list[0].name).toBe('test')
  })

  test('parses command with no args', async () => {
    const registry = new CommandRegistry()
    registry.register(mockCommand)
    const result = await registry.execute('test', makeContext())
    expect(result!.output).toBe('args: ')
  })

  test('parses command with multi-word args', async () => {
    const registry = new CommandRegistry()
    registry.register(mockCommand)
    const result = await registry.execute('test one two three', makeContext())
    expect(result!.output).toBe('args: one two three')
  })
})
