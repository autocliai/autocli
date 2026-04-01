import { describe, it, expect } from 'bun:test'
import { renderProgressBar } from './progressBar.js'

describe('renderProgressBar', () => {
  it('renders 0%', () => {
    const bar = renderProgressBar(0)
    expect(bar).toContain('0%')
  })

  it('renders 100%', () => {
    const bar = renderProgressBar(1)
    expect(bar).toContain('100%')
  })

  it('renders 50%', () => {
    const bar = renderProgressBar(0.5)
    expect(bar).toContain('50%')
  })

  it('clamps fraction > 1 to 100%', () => {
    const bar = renderProgressBar(1.5)
    expect(bar).toContain('100%')
  })

  it('clamps fraction < 0 to 0%', () => {
    const bar = renderProgressBar(-0.5)
    expect(bar).toContain('0%')
  })

  it('includes label when provided', () => {
    const bar = renderProgressBar(0.5, 30, 'Progress')
    expect(bar).toContain('Progress')
  })

  it('returns a string', () => {
    expect(typeof renderProgressBar(0.5)).toBe('string')
  })

  it('respects custom width', () => {
    const narrow = renderProgressBar(0.5, 10)
    const wide = renderProgressBar(0.5, 50)
    expect(narrow.length).toBeLessThan(wide.length)
  })
})
