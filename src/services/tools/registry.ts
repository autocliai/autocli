import type { ToolDefinition } from './types.js'
import type { ToolSchema } from '../providers/types.js'
import { zodToJsonSchema } from '../../utils/zodToJson.js'

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()
  register(tool: ToolDefinition): void { this.tools.set(tool.name, tool) }
  get(name: string): ToolDefinition | undefined { return this.tools.get(name) }
  list(): ToolDefinition[] { return [...this.tools.values()] }
  has(name: string): boolean { return this.tools.has(name) }
  toApiSchemas(): ToolSchema[] {
    return this.list().map(t => ({ name: t.name, description: t.description, input_schema: zodToJsonSchema(t.inputSchema) }))
  }
  filter(allowedNames: string[]): ToolRegistry {
    const filtered = new ToolRegistry()
    for (const name of allowedNames) { const tool = this.tools.get(name); if (tool) filtered.register(tool) }
    return filtered
  }
}
