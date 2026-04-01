import type { Message } from '../commands/types.js'

export interface Session {
  id: string
  createdAt: string
  updatedAt: string
  workingDir: string
  messages: Message[]
  totalCost: number
  totalTokens: { input: number; output: number }
  title?: string
}

export interface SessionMetadata {
  id: string
  createdAt: string
  updatedAt: string
  workingDir: string
  messageCount: number
  title?: string
}
