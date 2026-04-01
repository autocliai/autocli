export type CommandResult =
  | { type: 'output'; text: string }
  | { type: 'prompt'; prompt: string }
  | { type: 'compact' }
  | { type: 'clear' }
  | { type: 'plan_toggle' }
  | { type: 'yolo_toggle' }
  | { type: 'model_switch'; model: string }
  | { type: 'list_bg_tasks' }
  | { type: 'rewind'; turns: number }
  | { type: 'vim_toggle' }

export interface CommandDefinition {
  name: string
  description: string
  aliases?: string[]
  run(args: string[], context: CommandContext): Promise<string | CommandResult>
}

export interface CommandContext {
  workingDir: string
  sessionId: string
  messages: Message[]
  totalCost: number
  totalTokens: { input: number; output: number }
}

export type Message = {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
