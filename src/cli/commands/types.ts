import type { Message } from '../../services/providers/types.js'

export interface CommandResult {
  type?: string
  output?: string
  prompt?: string
  model?: string
  sessionId?: string
  [key: string]: unknown
}

export interface CommandContext {
  workingDir: string
  messages: Message[]
  sessionId: string
  model: string
  [key: string]: unknown
}

export interface CommandDefinition {
  name: string
  aliases?: string[]
  description: string
  execute(args: string, context: CommandContext): Promise<CommandResult>
}
