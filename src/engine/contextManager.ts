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
}
