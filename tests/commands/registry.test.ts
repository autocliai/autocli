import { describe, expect, test } from 'bun:test'
import { CommandRegistry } from '../../src/commands/registry.js'
import type { CommandDefinition } from '../../src/commands/types.js'

const mockCmd: CommandDefinition = {
  name: 'test',
  description: 'A test command',
  aliases: ['t'],
  async run() { return 'test output' },
}

describe('CommandRegistry', () => {
  test('registers and finds a command', () => {
    const reg = new CommandRegistry()
    reg.register(mockCmd)
    expect(reg.get('test')).toBe(mockCmd)
  })

  test('finds by alias', () => {
    const reg = new CommandRegistry()
    reg.register(mockCmd)
    expect(reg.get('t')).toBe(mockCmd)
  })

  test('returns undefined for unknown', () => {
    const reg = new CommandRegistry()
    expect(reg.get('unknown')).toBeUndefined()
  })

  test('parses command input', () => {
    const reg = new CommandRegistry()
    const parsed = reg.parse('/test arg1 arg2')
    expect(parsed).toEqual({ name: 'test', args: ['arg1', 'arg2'] })
  })

  test('detects non-commands', () => {
    const reg = new CommandRegistry()
    expect(reg.parse('not a command')).toBeUndefined()
  })
})
