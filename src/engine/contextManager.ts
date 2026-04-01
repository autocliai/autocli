import type { Message } from '../commands/types.js'

export class ContextManager {
  private maxTokens: number

  constructor(maxTokens = 180_000) {
    this.maxTokens = maxTokens
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  private messageTokens(msg: Message): number {
    if (typeof msg.content === 'string') {
      return this.estimateTokens(msg.content)
    }
    return msg.content.reduce((sum, block) => {
      if ('text' in block) return sum + this.estimateTokens(block.text)
      if ('content' in block) return sum + this.estimateTokens(String(block.content))
      return sum + 50
    }, 0)
  }

  fitToContext(messages: Message[]): Message[] {
    if (messages.length === 0) return messages

    const totalTokens = messages.reduce((sum, m) => sum + this.messageTokens(m), 0)

    if (totalTokens <= this.maxTokens) return messages

    const result: Message[] = []
    let budget = this.maxTokens

    const lastMsg = messages[messages.length - 1]
    budget -= this.messageTokens(lastMsg)

    for (let i = messages.length - 2; i >= 0; i--) {
      const cost = this.messageTokens(messages[i])
      if (budget - cost < 0) break
      budget -= cost
      result.unshift(messages[i])
    }

    const dropped = messages.length - 1 - result.length
    if (dropped > 0) {
      result.unshift({
        role: 'user',
        content: `[Earlier conversation compacted — ${dropped} messages summarized. Key context may have been lost. Ask the user to repeat if needed.]`,
      })
    }

    result.push(lastMsg)
    return result
  }

  needsCompaction(messages: Message[]): boolean {
    const total = messages.reduce((sum, m) => sum + this.messageTokens(m), 0)
    return total > this.maxTokens * 0.9
  }

  async compactWithLLM(
    messages: Message[],
    summarize: (text: string) => Promise<string>,
  ): Promise<Message[]> {
    if (messages.length <= 4) return messages

    // Find a safe split point: at a user message with string content (not tool results)
    // Must not split a tool_use/tool_result pair
    let splitIdx = Math.floor(messages.length / 2)
    let foundSplit = false

    const isSafeSplit = (idx: number): boolean => {
      const msg = messages[idx]
      // Don't split at a user message that contains tool_results — it pairs with the preceding assistant
      if (Array.isArray(msg.content)) {
        const hasToolResults = (msg.content as Array<{ type: string }>).some(b => b.type === 'tool_result')
        if (hasToolResults) return false
      }
      return true
    }

    for (let i = splitIdx; i > 2; i--) {
      const msg = messages[i]
      if (msg.role === 'user' && typeof msg.content === 'string' && isSafeSplit(i)) {
        splitIdx = i
        foundSplit = true
        break
      }
    }
    // If no string user message found searching backward, try forward
    if (!foundSplit) {
      for (let i = splitIdx; i < messages.length - 2; i++) {
        const msg = messages[i]
        if (msg.role === 'user' && typeof msg.content === 'string' && isSafeSplit(i)) {
          splitIdx = i
          foundSplit = true
          break
        }
      }
    }
    // Last resort: find any safe user message boundary
    if (!foundSplit) {
      for (let i = splitIdx; i > 2; i--) {
        if (messages[i].role === 'user' && messages[i - 1]?.role === 'assistant' && isSafeSplit(i)) {
          splitIdx = i
          break
        }
      }
    }

    // Build text from old messages for summarization (including tool call summaries)
    const oldMessages = messages.slice(0, splitIdx)
    const transcript = oldMessages
      .map(m => {
        if (typeof m.content === 'string') {
          return `${m.role}: ${m.content}`
        }
        // Summarize content blocks
        const parts: string[] = []
        for (const block of m.content) {
          if (block.type === 'text') parts.push(block.text)
          else if (block.type === 'tool_use') parts.push(`[Tool: ${block.name}]`)
          else if (block.type === 'tool_result') {
            const preview = block.content.slice(0, 200)
            parts.push(`[Result: ${preview}${block.content.length > 200 ? '...' : ''}]`)
          }
        }
        return parts.length > 0 ? `${m.role}: ${parts.join(' ')}` : ''
      })
      .filter(Boolean)
      .join('\n\n')

    if (!transcript.trim()) return this.fitToContext(messages)

    try {
      const summary = await summarize(
        `Summarize this conversation concisely. Preserve key decisions, file paths mentioned, errors encountered, and current task context. Be brief.\n\n${transcript}`
      )

      const recentMessages = messages.slice(splitIdx)
      return [
        { role: 'user', content: `[Previous conversation summary]\n${summary}` },
        { role: 'assistant', content: 'Understood. I have context from our previous discussion. How can I continue helping?' },
        ...recentMessages,
      ]
    } catch {
      // Fallback to simple compaction
      return this.fitToContext(messages)
    }
  }
}
