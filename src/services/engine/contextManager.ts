import type { Message } from '../providers/types.js'

const DEFAULT_MAX_TOKENS = 180000

export class ContextManager {
  private maxTokens: number
  constructor(maxTokens = DEFAULT_MAX_TOKENS) { this.maxTokens = maxTokens }

  fitToContext(messages: Message[]): Message[] {
    if (this.estimateTokens(messages) <= this.maxTokens) return [...messages]
    const result = [...messages]
    while (this.estimateTokens(result) > this.maxTokens && result.length > 2) {
      // Find the first removable pair starting from index 1
      let removed = false
      for (let idx = 1; idx < result.length && !removed; idx++) {
        const msg = result[idx]
        if (msg.role === 'assistant' && msg.content.some(b => b.type === 'tool_use')) {
          // Remove paired tool_result first (higher index), then the assistant message
          const toolIds = msg.content.filter(b => b.type === 'tool_use' && b.id).map(b => b.id!)
          const resultIdx = result.findIndex((m, i) => i > idx && m.role === 'tool_result' && m.content.some(b => b.tool_use_id && toolIds.includes(b.tool_use_id)))
          if (resultIdx >= 0) result.splice(resultIdx, 1)
          result.splice(idx, 1)
          removed = true
        } else if (msg.role === 'tool_result') {
          // Remove the tool_result and its preceding assistant with matching tool_use
          const toolUseIds = msg.content.filter(b => b.tool_use_id).map(b => b.tool_use_id!)
          const assistantIdx = result.findIndex((m, i) => i < idx && m.role === 'assistant' && m.content.some(b => b.type === 'tool_use' && b.id && toolUseIds.includes(b.id)))
          if (assistantIdx >= 0) {
            result.splice(idx, 1)
            result.splice(assistantIdx, 1)
            removed = true
          } else {
            // No paired assistant found — remove just the orphaned tool_result
            result.splice(idx, 1)
            removed = true
          }
        } else {
          // Regular user/assistant message — safe to remove
          result.splice(idx, 1)
          removed = true
        }
      }
      if (!removed) break // Safety: prevent infinite loop
    }
    return result
  }

  estimateTokens(messages: Message[]): number {
    let total = 0
    for (const msg of messages) {
      for (const block of msg.content) {
        const text = block.text || block.content || (block.input ? JSON.stringify(block.input) : '')
        total += Math.ceil((text?.length || 0) / 4)
      }
    }
    return total
  }

  needsCompaction(messages: Message[]): boolean { return this.estimateTokens(messages) > this.maxTokens * 0.9 }
}
