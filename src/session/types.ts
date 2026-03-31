import type { Message } from '../commands/types.js'

export interface Session {
  id: string
  createdAt: string
  updatedAt: string
  workingDir: string
  messages: Message[]
  totalCost: number
  totalTokens: { input: number; output: number }
}

export interface SessionMetadata {
  id: string
  createdAt: string
  updatedAt: string
  workingDir: string
  messageCount: number
}
