import { describe, it, expect } from 'bun:test'
import { getServerStatus } from './status.js'

describe('getServerStatus', () => {
  it('returns ok status', () => {
    const counter = { totalInput: 1000, totalOutput: 500, formatCost: () => '$0.0100' } as any
    const result = getServerStatus(Date.now() - 60000, 3, counter)
    expect(result.status).toBe('ok')
  })

  it('calculates uptime in seconds', () => {
    const counter = { totalInput: 0, totalOutput: 0, formatCost: () => '$0.0000' } as any
    const result = getServerStatus(Date.now() - 120000, 0, counter)
    expect(result.uptime).toBeGreaterThanOrEqual(119)
    expect(result.uptime).toBeLessThanOrEqual(121)
  })

  it('includes session count', () => {
    const counter = { totalInput: 0, totalOutput: 0, formatCost: () => '$0.0000' } as any
    const result = getServerStatus(Date.now(), 5, counter)
    expect(result.activeSessions).toBe(5)
  })

  it('includes token totals from counter', () => {
    const counter = { totalInput: 2000, totalOutput: 1000, formatCost: () => '$0.0500' } as any
    const result = getServerStatus(Date.now(), 1, counter)
    expect(result.totalTokens.input).toBe(2000)
    expect(result.totalTokens.output).toBe(1000)
    expect(result.totalCost).toBe('$0.0500')
  })
})
