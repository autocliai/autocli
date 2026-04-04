import { z } from 'zod'
import type { ToolDefinition, ToolResult } from './types.js'

export const thinkTool: ToolDefinition = {
  name: 'Think',
  description: 'Use this tool to think through a problem step by step.',
  inputSchema: z.object({ thought: z.string().describe('Your reasoning') }),
  isReadOnly: true,
  async call(input: unknown): Promise<ToolResult> {
    const { thought } = input as { thought: string }
    return { output: `Thought recorded (${thought.length} chars)` }
  },
}
