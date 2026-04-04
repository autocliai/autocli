import type { ToolRegistry } from '../tools/registry.js'
import type { ToolCall, ToolResult, ToolContext } from '../tools/types.js'
import type { PermissionGate } from '../permissions/permissionGate.js'
import type { EventBus } from '../events/eventBus.js'
import { logger } from '../../utils/logger.js'

const MAX_OUTPUT = 100 * 1024

export class ToolExecutor {
  constructor(
    private toolRegistry: ToolRegistry,
    private permissionGate: PermissionGate,
    private eventBus: EventBus,
  ) {}

  async executeAll(toolCalls: ToolCall[], context: ToolContext): Promise<{ id: string; result: ToolResult }[]> {
    const results: { id: string; result: ToolResult }[] = []
    for (const call of toolCalls) {
      const result = await this.executeOne(call, context)
      results.push({ id: call.id, result })
    }
    // Clean up skill-scoped tool restrictions after the entire batch completes
    if (context.sharedState.skillAllowedTools) delete context.sharedState.skillAllowedTools
    return results
  }

  async executeOne(call: ToolCall, context: ToolContext): Promise<ToolResult> {
    const tool = this.toolRegistry.get(call.name)
    if (!tool) return { output: `Unknown tool: ${call.name}`, isError: true }

    const planMode = !!context.sharedState.planMode
    if (planMode && !tool.isReadOnly) return { output: `Tool ${call.name} blocked: plan mode is active (read-only)`, isError: true }

    const allowedTools = context.sharedState.skillAllowedTools as string[] | undefined
    if (allowedTools && !allowedTools.includes(call.name)) return { output: `Tool ${call.name} not allowed by current skill`, isError: true }

    this.eventBus.emit('tool_call', { name: call.name, input: call.input, id: call.id })

    const allowed = await this.permissionGate.check(call.name, call.input as Record<string, unknown>, tool.isReadOnly, planMode)
    if (!allowed) return { output: `Tool ${call.name} denied by permission gate`, isError: true }

    try {
      const result = await tool.call(call.input, context)
      if (result.output.length > MAX_OUTPUT) result.output = result.output.slice(0, MAX_OUTPUT) + '\n... (output truncated)'
      this.eventBus.emit('tool_result', { name: call.name, id: call.id, output: result.output.slice(0, 500), isError: result.isError })
      return result
    } catch (e) {
      const error = String(e)
      logger.error('Tool execution failed', { tool: call.name, error })
      this.eventBus.emit('error', { tool: call.name, error })
      return { output: `Error: ${error}`, isError: true }
    }
  }
}
