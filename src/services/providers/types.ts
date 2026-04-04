export interface StreamChunk {
  type: 'text' | 'tool_use' | 'thinking' | 'usage' | 'done'
  text?: string
  id?: string
  name?: string
  input?: unknown
  inputTokens?: number
  outputTokens?: number
}

export interface ToolSchema {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface Message {
  role: 'user' | 'assistant' | 'tool_result'
  content: ContentBlock[]
}

export interface ContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: string
  is_error?: boolean
  [key: string]: unknown
}

export interface LLMProvider {
  name: string
  stream(systemPrompt: string, messages: Message[], tools: ToolSchema[], options?: { maxTokens?: number; model?: string }): AsyncIterable<StreamChunk>
  transformPrompt?(systemPrompt: string): string
  transformToolSchemas?(tools: ToolSchema[]): ToolSchema[]
}

export interface RunResult {
  response: Message
  messages: Message[]
  inputTokens: number
  outputTokens: number
}
