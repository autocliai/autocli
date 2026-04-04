import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from './types.js'

export const agentTool: ToolDefinition = {
  name: 'Agent',
  description: 'Launch a sub-agent to handle a complex task.',
  inputSchema: z.object({
    prompt: z.string().describe('Task description for the sub-agent'),
    model: z.string().optional(), provider: z.string().optional(),
    run_in_background: z.boolean().optional(),
  }),
  isReadOnly: true,
  async call(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { prompt, model, provider, run_in_background } = input as { prompt: string; model?: string; provider?: string; run_in_background?: boolean }
    const runSubAgent = ctx.sharedState.runSubAgent as ((prompt: string, opts: { model?: string; provider?: string; background?: boolean }) => Promise<string>) | undefined
    if (!runSubAgent) return { output: 'Error: Sub-agent execution not available', isError: true }
    const result = await runSubAgent(prompt, { model, provider, background: run_in_background })
    return { output: result }
  },
}
