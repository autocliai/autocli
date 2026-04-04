import { describe, test, expect } from 'bun:test'
import { permissionsCommand } from '../../src/cli/commands/permissions.js'
import { makeContext } from './helpers.js'

describe('permissions command', () => {
  test('no args returns permissions_show type', async () => {
    const result = await permissionsCommand.execute('', makeContext())
    expect(result.type).toBe('permissions_show')
  })

  test('allow subcommand returns permissions_add_rule', async () => {
    const result = await permissionsCommand.execute('allow Bash', makeContext())
    expect(result.type).toBe('permissions_add_rule')
    expect((result as any).rule.tool).toBe('Bash')
    expect((result as any).rule.decision).toBe('allow')
  })

  test('allow with pattern returns rule with pattern', async () => {
    const result = await permissionsCommand.execute('allow Bash *.sh', makeContext())
    expect(result.type).toBe('permissions_add_rule')
    expect((result as any).rule.tool).toBe('Bash')
    expect((result as any).rule.pattern).toBe('*.sh')
    expect((result as any).rule.decision).toBe('allow')
  })

  test('deny subcommand returns permissions_add_rule with deny', async () => {
    const result = await permissionsCommand.execute('deny Write', makeContext())
    expect(result.type).toBe('permissions_add_rule')
    expect((result as any).rule.tool).toBe('Write')
    expect((result as any).rule.decision).toBe('deny')
  })

  test('allow without tool name returns error', async () => {
    const result = await permissionsCommand.execute('allow', makeContext())
    expect(result.output).toContain('Missing tool name')
  })

  test('deny without tool name returns error', async () => {
    const result = await permissionsCommand.execute('deny', makeContext())
    expect(result.output).toContain('Missing tool name')
  })

  test('remove with valid index returns permissions_remove_rule', async () => {
    const result = await permissionsCommand.execute('remove 1', makeContext())
    expect(result.type).toBe('permissions_remove_rule')
    expect((result as any).index).toBe(0)
  })

  test('remove with invalid index returns error', async () => {
    const result = await permissionsCommand.execute('remove abc', makeContext())
    expect(result.output).toContain('Invalid rule index')
  })

  test('remove with zero index returns error', async () => {
    const result = await permissionsCommand.execute('remove 0', makeContext())
    expect(result.output).toContain('Invalid rule index')
  })

  test('reset returns permissions_reset type', async () => {
    const result = await permissionsCommand.execute('reset', makeContext())
    expect(result.type).toBe('permissions_reset')
  })

  test('mode with valid mode returns permissions_set_mode', async () => {
    for (const mode of ['default', 'auto-approve', 'deny-all', 'llm-confirm']) {
      const result = await permissionsCommand.execute(`mode ${mode}`, makeContext())
      expect(result.type).toBe('permissions_set_mode')
      expect((result as any).mode).toBe(mode)
    }
  })

  test('mode with invalid mode returns error', async () => {
    const result = await permissionsCommand.execute('mode bad-mode', makeContext())
    expect(result.output).toContain('Invalid mode')
  })

  test('mode without argument returns error', async () => {
    const result = await permissionsCommand.execute('mode', makeContext())
    expect(result.output).toContain('Invalid mode')
  })

  test('unknown subcommand returns error', async () => {
    const result = await permissionsCommand.execute('badcmd', makeContext())
    expect(result.output).toContain('Unknown subcommand')
  })

  test('has correct name and aliases', () => {
    expect(permissionsCommand.name).toBe('permissions')
    expect(permissionsCommand.aliases).toContain('perms')
  })
})
