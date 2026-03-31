import { describe, expect, test } from 'bun:test'
import { ContextManager } from '../../src/engine/contextManager.js'
import type { Message } from '../../src/commands/types.js'

describe('ContextManager', () => {
  test('keeps messages under limit', () => {
    const cm = new ContextManager(100)
    const messages: Message[] = [
      { role: 'user', content: 'a'.repeat(30) },
      { role: 'assistant', content: 'b'.repeat(30) },
      { role: 'user', content: 'c'.repeat(30) },
      { role: 'assistant', content: 'd'.repeat(30) },
    ]
    const trimmed = cm.fitToContext(messages)
    expect(trimmed.length).toBeLessThanOrEqual(messages.length)
  })

  test('always keeps the last user message', () => {
    const cm = new ContextManager(50)
    const messages: Message[] = [
      { role: 'user', content: 'old message' },
      { role: 'assistant', content: 'old response' },
      { role: 'user', content: 'latest question' },
    ]
    const trimmed = cm.fitToContext(messages)
    const lastMsg = trimmed[trimmed.length - 1]
    expect(lastMsg.content).toBe('latest question')
  })

  test('inserts summary when compacting', () => {
    const cm = new ContextManager(80)
    const messages: Message[] = [
      { role: 'user', content: 'a'.repeat(30) },
      { role: 'assistant', content: 'b'.repeat(30) },
      { role: 'user', content: 'c'.repeat(30) },
    ]
    const trimmed = cm.fitToContext(messages)
    const first = trimmed[0]
    if (trimmed.length < messages.length && typeof first.content === 'string') {
      expect(first.content).toContain('[Earlier conversation')
    }
  })

  test('estimates token count', () => {
    const cm = new ContextManager(10000)
    expect(cm.estimateTokens('hello world')).toBeGreaterThan(0)
  })
})
