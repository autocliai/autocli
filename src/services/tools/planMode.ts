import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from './types.js'

export const enterPlanModeTool: ToolDefinition = {
  name: 'EnterPlanMode',
  description: 'Enter read-only plan mode for research.',
  inputSchema: z.object({}),
  isReadOnly: true,
  async call(_input: unknown, ctx: ToolContext): Promise<ToolResult> {
    ctx.sharedState.planMode = true
    return { output: 'Plan mode enabled. Only read-only tools will be executed.' }
  },
}

export const exitPlanModeTool: ToolDefinition = {
  name: 'ExitPlanMode',
  description: 'Exit plan mode, re-enabling write tools.',
  inputSchema: z.object({}),
  isReadOnly: true,
  async call(_input: unknown, ctx: ToolContext): Promise<ToolResult> {
    ctx.sharedState.planMode = false
    return { output: 'Plan mode disabled. All tools available.' }
  },
}
