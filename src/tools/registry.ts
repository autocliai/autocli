import type { ToolDefinition } from './types.js'
import { zodToJsonSchema } from '../utils/zodToJson.js'

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  toApiSchemas(): Array<{ name: string; description: string; input_schema: Record<string, unknown> }> {
    return this.list().map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: zodToJsonSchema(tool.inputSchema),
    }))
  }
}
