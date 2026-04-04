import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from './types.js'

export const askUserTool: ToolDefinition = {
  name: 'AskUser',
  description: 'Ask the user a clarifying question.',
  inputSchema: z.object({ question: z.string().describe('The question to ask') }),
  isReadOnly: true,
  async call(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { question } = input as { question: string }
    const readLine = ctx.sharedState.readSingleLine as ((prompt: string) => Promise<string>) | undefined
    if (!readLine) return { output: 'Error: No user input available', isError: true }
    const answer = await readLine(question)
    return { output: answer }
  },
}
