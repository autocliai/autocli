import { describe, expect, test } from 'bun:test'
import { ToolRegistry } from '../../src/tools/registry.js'
import { CommandRegistry } from '../../src/commands/registry.js'
import { TokenCounter } from '../../src/engine/tokenCounter.js'
import { ContextManager } from '../../src/engine/contextManager.js'
import { SessionStore } from '../../src/session/sessionStore.js'
import { MemoryManager } from '../../src/memory/memoryManager.js'
import { SkillLoader } from '../../src/skills/loader.js'
import { HookRunner } from '../../src/hooks/hookRunner.js'
import { PermissionGate } from '../../src/permissions/permissionGate.js'
import { registerAllTools } from '../../src/tools/registerAll.js'
import { helpCommand } from '../../src/commands/help.js'
import { costCommand } from '../../src/commands/cost.js'

describe('Integration: all subsystems initialize', () => {
  test('tool registry loads all tools', () => {
    const reg = new ToolRegistry()
    registerAllTools(reg)
    const tools = reg.list()
    expect(tools.length).toBe(7)
    expect(tools.map(t => t.name).sort()).toEqual([
      'Agent', 'Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write',
    ])
  })

  test('command registry loads commands', () => {
    const reg = new CommandRegistry()
    reg.register(helpCommand)
    reg.register(costCommand)
    expect(reg.list().length).toBe(2)
  })

  test('all subsystems can be instantiated together', () => {
    const toolRegistry = new ToolRegistry()
    registerAllTools(toolRegistry)
    const tokenCounter = new TokenCounter('claude-sonnet-4-20250514')
    const contextManager = new ContextManager()
    const sessionStore = new SessionStore('/tmp/mini-claude-smoke-test')
    const memoryManager = new MemoryManager('/tmp/mini-claude-smoke-memory')
    const skillLoader = new SkillLoader([])
    const hookRunner = new HookRunner([])
    const permissionGate = new PermissionGate({ mode: 'default', rules: [], alwaysAllow: new Set() })

    expect(toolRegistry.list().length).toBe(7)
    expect(tokenCounter.totalCost).toBe(0)
    expect(contextManager.estimateTokens('hello')).toBeGreaterThan(0)
    expect(sessionStore.list()).toBeDefined()
    expect(memoryManager.list()).toBeDefined()
    expect(skillLoader.list()).toBeDefined()
  })
})
