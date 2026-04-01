import { describe, it, expect } from 'bun:test'
import { z } from 'zod'
import { ToolRegistry } from './registry.js'

const makeTool = (name: string, desc = 'test tool') => ({
  name,
  description: desc,
  inputSchema: z.object({ path: z.string() }),
  isReadOnly: true,
  call: async () => ({ output: 'ok' }),
})

describe('ToolRegistry', () => {
  it('registers and retrieves a tool', () => {
    const reg = new ToolRegistry()
    const tool = makeTool('read')
    reg.register(tool)
    expect(reg.get('read')).toBe(tool)
  })

  it('returns undefined for unknown tool', () => {
    const reg = new ToolRegistry()
    expect(reg.get('missing')).toBeUndefined()
  })

  it('lists all registered tools', () => {
    const reg = new ToolRegistry()
    reg.register(makeTool('read'))
    reg.register(makeTool('write'))
    expect(reg.list().length).toBe(2)
    expect(reg.list().map(t => t.name).sort()).toEqual(['read', 'write'])
  })

  it('overwrites tool with same name', () => {
    const reg = new ToolRegistry()
    reg.register(makeTool('read', 'first'))
    reg.register(makeTool('read', 'second'))
    expect(reg.get('read')!.description).toBe('second')
    expect(reg.list().length).toBe(1)
  })

  it('converts to API schemas', () => {
    const reg = new ToolRegistry()
    reg.register(makeTool('read'))
    const schemas = reg.toApiSchemas()
    expect(schemas.length).toBe(1)
    expect(schemas[0].name).toBe('read')
    expect(schemas[0].description).toBe('test tool')
    expect(schemas[0].input_schema).toHaveProperty('type', 'object')
    expect(schemas[0].input_schema).toHaveProperty('properties')
  })
})
