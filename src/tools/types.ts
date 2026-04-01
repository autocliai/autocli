import { z } from 'zod'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: z.ZodType<unknown>
  isReadOnly: boolean
  call(input: unknown, context: ToolContext): Promise<ToolResult>
}

export interface ToolContext {
  workingDir: string
  abortSignal?: AbortSignal
  onProgress?: (text: string) => void
  sharedState?: Record<string, unknown>
}

export interface ToolResult {
  output: string
  isError?: boolean
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}
