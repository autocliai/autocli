import { describe, it, expect, beforeEach } from 'bun:test'
import { TokenCounter } from './tokenCounter.js'

describe('TokenCounter', () => {
  let counter: TokenCounter

  describe('constructor', () => {
    it('uses default pricing when no model', () => {
      counter = new TokenCounter()
      counter.add({ input: 1_000_000, output: 1_000_000 })
      // default: input=3, output=15 → 3 + 15 = 18
      expect(counter.totalCost).toBeCloseTo(18, 2)
    })

    it('uses model-specific pricing for known model', () => {
      counter = new TokenCounter('claude-opus-4-20250514')
      counter.add({ input: 1_000_000, output: 1_000_000 })
      // opus: input=15, output=75 → 15 + 75 = 90
      expect(counter.totalCost).toBeCloseTo(90, 2)
    })

    it('falls back to default for unknown model', () => {
      counter = new TokenCounter('unknown-model')
      counter.add({ input: 1_000_000, output: 1_000_000 })
      expect(counter.totalCost).toBeCloseTo(18, 2)
    })
  })

  describe('add', () => {
    beforeEach(() => { counter = new TokenCounter() })

    it('accumulates input tokens', () => {
      counter.add({ input: 100, output: 0 })
      counter.add({ input: 200, output: 0 })
      expect(counter.totalInput).toBe(300)
    })

    it('accumulates output tokens', () => {
      counter.add({ input: 0, output: 50 })
      counter.add({ input: 0, output: 75 })
      expect(counter.totalOutput).toBe(125)
    })
  })

  describe('totalCost', () => {
    it('calculates cost correctly', () => {
      counter = new TokenCounter('claude-sonnet-4-20250514')
      // sonnet: input=3, output=15
      counter.add({ input: 500_000, output: 100_000 })
      // (500000/1M)*3 + (100000/1M)*15 = 1.5 + 1.5 = 3.0
      expect(counter.totalCost).toBeCloseTo(3.0, 4)
    })

    it('returns 0 with no usage', () => {
      counter = new TokenCounter()
      expect(counter.totalCost).toBe(0)
    })
  })

  describe('formatCost', () => {
    it('formats as dollar amount with 4 decimals', () => {
      counter = new TokenCounter()
      counter.add({ input: 1000, output: 500 })
      expect(counter.formatCost()).toMatch(/^\$\d+\.\d{4}$/)
    })
  })

  describe('formatUsage', () => {
    it('includes arrows and cost', () => {
      counter = new TokenCounter()
      counter.add({ input: 1000, output: 500 })
      const usage = counter.formatUsage()
      expect(usage).toContain('↑')
      expect(usage).toContain('↓')
      expect(usage).toContain('$')
    })
  })

  describe('updateModel', () => {
    it('changes pricing for future cost calculations', () => {
      counter = new TokenCounter() // default pricing
      counter.add({ input: 1_000_000, output: 0 })
      const costBefore = counter.totalCost // 3.0

      counter.updateModel('claude-opus-4-20250514')
      // Now uses opus pricing: input=15
      // totalCost recalculates: (1M/1M)*15 = 15
      expect(counter.totalCost).toBeCloseTo(15, 2)
      expect(counter.totalCost).not.toBeCloseTo(costBefore, 0)
    })
  })
})
