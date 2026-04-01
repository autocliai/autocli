import { describe, it, expect } from 'bun:test'
import { HookRunner } from './hookRunner.js'
import type { HookDefinition } from './types.js'

describe('HookRunner', () => {
  it('returns neutral result when no hooks match', async () => {
    const runner = new HookRunner([])
    const result = await runner.run('before_tool_call', {})

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
    expect(result.blocked).toBe(false)
  })

  it('runs matching hook with successful command', async () => {
    const hooks: HookDefinition[] = [
      { event: 'before_tool_call', command: 'echo hello' },
    ]
    const runner = new HookRunner(hooks)
    const result = await runner.run('before_tool_call', {})

    expect(result.stdout).toContain('hello')
    expect(result.exitCode).toBe(0)
    expect(result.blocked).toBe(false)
  })

  it('only runs hooks when context.tool matches pattern', async () => {
    const hooks: HookDefinition[] = [
      { event: 'before_tool_call', command: 'echo matched', pattern: 'Write' },
    ]
    const runner = new HookRunner(hooks)

    const result1 = await runner.run('before_tool_call', { tool: 'Read' })
    expect(result1.stdout).toBe('')
    expect(result1.blocked).toBe(false)

    const result2 = await runner.run('before_tool_call', { tool: 'Write' })
    expect(result2.stdout).toContain('matched')
  })

  it('sets blocked=true and exitCode=1 on failed hook', async () => {
    const hooks: HookDefinition[] = [
      { event: 'before_tool_call', command: 'exit 1' },
    ]
    const runner = new HookRunner(hooks)
    const result = await runner.run('before_tool_call', {})

    expect(result.blocked).toBe(true)
    expect(result.exitCode).toBe(1)
  })

  it('combines stdout from multiple hooks and stops on first failure', async () => {
    const hooks: HookDefinition[] = [
      { event: 'after_tool_call', command: 'echo first' },
      { event: 'after_tool_call', command: 'exit 1' },
      { event: 'after_tool_call', command: 'echo should-not-run' },
    ]
    const runner = new HookRunner(hooks)
    const result = await runner.run('after_tool_call', {})

    expect(result.stdout).toContain('first')
    expect(result.stdout).not.toContain('should-not-run')
    expect(result.blocked).toBe(true)
  })

  it('sets environment variables correctly (HOOK_EVENT, HOOK_TOOL)', async () => {
    const hooks: HookDefinition[] = [
      { event: 'before_tool_call', command: 'echo $HOOK_EVENT' },
    ]
    const runner = new HookRunner(hooks)
    const result = await runner.run('before_tool_call', { tool: 'Write' })

    expect(result.stdout).toContain('before_tool_call')
  })

  it('does not run hooks for non-matching events', async () => {
    const hooks: HookDefinition[] = [
      { event: 'before_tool_call', command: 'echo wrong-event' },
    ]
    const runner = new HookRunner(hooks)
    const result = await runner.run('after_response', {})

    expect(result.stdout).toBe('')
    expect(result.blocked).toBe(false)
  })
})
