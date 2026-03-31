import { describe, expect, test } from 'bun:test'
import { HookRunner } from '../../src/hooks/hookRunner.js'

describe('HookRunner', () => {
  test('runs hook command', async () => {
    const runner = new HookRunner([
      { event: 'before_tool_call', command: 'echo hook-ran' },
    ])
    const result = await runner.run('before_tool_call', { tool: 'Bash' })
    expect(result.stdout).toContain('hook-ran')
    expect(result.blocked).toBe(false)
  })

  test('reports blocked when hook exits non-zero', async () => {
    const runner = new HookRunner([
      { event: 'before_tool_call', command: 'exit 1' },
    ])
    const result = await runner.run('before_tool_call', { tool: 'Bash' })
    expect(result.blocked).toBe(true)
  })

  test('skips hooks for non-matching events', async () => {
    const runner = new HookRunner([
      { event: 'after_response', command: 'echo should-not-run' },
    ])
    const result = await runner.run('before_tool_call', {})
    expect(result.stdout).toBe('')
    expect(result.blocked).toBe(false)
  })

  test('filters by pattern', async () => {
    const runner = new HookRunner([
      { event: 'before_tool_call', command: 'echo matched', pattern: 'Bash' },
    ])

    const r1 = await runner.run('before_tool_call', { tool: 'Bash' })
    expect(r1.stdout).toContain('matched')

    const r2 = await runner.run('before_tool_call', { tool: 'FileRead' })
    expect(r2.stdout).toBe('')
  })
})
