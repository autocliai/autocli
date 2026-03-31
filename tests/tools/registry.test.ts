import { describe, expect, test } from 'bun:test'
import { ToolRegistry } from '../../src/tools/registry.js'
import type { ToolDefinition } from '../../src/tools/types.js'
import { z } from 'zod'

const mockTool: ToolDefinition = {
  name: 'TestTool',
  description: 'A test tool',
  inputSchema: z.object({ input: z.string() }),
  isReadOnly: true,
  async call(input) {
    const parsed = input as { input: string }
    return { output: `echo: ${parsed.input}` }
  },
}

describe('ToolRegistry', () => {
  test('registers and retrieves a tool', () => {
    const registry = new ToolRegistry()
    registry.register(mockTool)
    expect(registry.get('TestTool')).toBe(mockTool)
  })

  test('returns undefined for unknown tool', () => {
    const registry = new ToolRegistry()
    expect(registry.get('Unknown')).toBeUndefined()
  })

  test('lists all registered tools', () => {
    const registry = new ToolRegistry()
    registry.register(mockTool)
    const tools = registry.list()
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('TestTool')
  })

  test('generates tool schemas for API', () => {
    const registry = new ToolRegistry()
    registry.register(mockTool)
    const schemas = registry.toApiSchemas()
    expect(schemas).toHaveLength(1)
    expect(schemas[0].name).toBe('TestTool')
    expect(schemas[0].input_schema).toBeDefined()
  })
})
