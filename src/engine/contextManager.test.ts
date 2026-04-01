import { describe, it, expect } from 'bun:test'
import { ContextManager } from './contextManager.js'

type Message = { role: 'user' | 'assistant'; content: string | any[] }

const msg = (role: 'user' | 'assistant', content: string): Message => ({ role, content })

describe('ContextManager', () => {
  describe('estimateTokens', () => {
    it('returns ceil(length / 4)', () => {
      const cm = new ContextManager()
      expect(cm.estimateTokens('abcd')).toBe(1)
      expect(cm.estimateTokens('abcde')).toBe(2)
      expect(cm.estimateTokens('')).toBe(0)
      expect(cm.estimateTokens('a'.repeat(100))).toBe(25)
    })
  })

  describe('fitToContext', () => {
    it('returns empty for empty messages', () => {
      const cm = new ContextManager(100)
      expect(cm.fitToContext([])).toEqual([])
    })

    it('returns all messages when under budget', () => {
      const cm = new ContextManager(10000)
      const messages = [msg('user', 'hi'), msg('assistant', 'hello')]
      expect(cm.fitToContext(messages as any)).toEqual(messages)
    })

    it('drops oldest messages when over budget', () => {
      const cm = new ContextManager(20) // very small budget
      const messages = [
        msg('user', 'a'.repeat(40)),
        msg('assistant', 'b'.repeat(40)),
        msg('user', 'c'.repeat(40)),
        msg('assistant', 'd'.repeat(20)),
      ]
      const result = cm.fitToContext(messages as any)
      // Should keep last message and drop some earlier ones
      expect(result.length).toBeLessThan(messages.length)
      expect(result[result.length - 1]).toEqual(messages[messages.length - 1])
    })

    it('adds compaction notice when messages dropped', () => {
      const cm = new ContextManager(20)
      const messages = [
        msg('user', 'a'.repeat(100)),
        msg('assistant', 'b'.repeat(100)),
        msg('user', 'short'),
      ]
      const result = cm.fitToContext(messages as any)
      const firstContent = (result[0] as any).content as string
      expect(firstContent).toContain('compacted')
    })
  })

  describe('needsCompaction', () => {
    it('returns false when under 90% budget', () => {
      const cm = new ContextManager(10000)
      expect(cm.needsCompaction([msg('user', 'hi')] as any)).toBe(false)
    })

    it('returns true when over 90% budget', () => {
      const cm = new ContextManager(10) // 10 tokens budget
      const messages = [msg('user', 'a'.repeat(40))] // 10 tokens, >=90%
      expect(cm.needsCompaction(messages as any)).toBe(true)
    })
  })

  describe('compactWithLLM', () => {
    it('returns unchanged for <= 4 messages', () => {
      const cm = new ContextManager()
      const messages = [msg('user', 'a'), msg('assistant', 'b')] as any
      const result = cm.compactWithLLM(messages, async () => 'summary')
      expect(result).resolves.toEqual(messages)
    })

    it('calls summarize and returns summary + recent messages', async () => {
      const cm = new ContextManager()
      const messages = [
        msg('user', 'first'),
        msg('assistant', 'response1'),
        msg('user', 'second'),
        msg('assistant', 'response2'),
        msg('user', 'third'),
        msg('assistant', 'response3'),
      ] as any

      let summarizeCalled = false
      const result = await cm.compactWithLLM(messages, async (text) => {
        summarizeCalled = true
        return 'This is the summary'
      })

      expect(summarizeCalled).toBe(true)
      expect(result[0].content).toContain('summary')
      expect(result[1].role).toBe('assistant')
      expect(result.length).toBeLessThan(messages.length)
    })

    it('falls back to fitToContext on error', async () => {
      const cm = new ContextManager(10000)
      const messages = [
        msg('user', 'a'),
        msg('assistant', 'b'),
        msg('user', 'c'),
        msg('assistant', 'd'),
        msg('user', 'e'),
      ] as any

      const result = await cm.compactWithLLM(messages, async () => {
        throw new Error('API failed')
      })

      // Should still return messages (fitToContext fallback)
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
