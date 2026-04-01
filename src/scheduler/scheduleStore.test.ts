import { describe, it, expect } from 'bun:test'
import { parseInterval, formatInterval } from './scheduleStore.js'

describe('parseInterval', () => {
  it('parses days', () => {
    expect(parseInterval('1d')).toBe(86400_000)
  })

  it('parses hours', () => {
    expect(parseInterval('2h')).toBe(7_200_000)
  })

  it('parses minutes', () => {
    expect(parseInterval('30m')).toBe(1_800_000)
  })

  it('parses seconds', () => {
    expect(parseInterval('30s')).toBe(30_000)
  })

  it('parses combined units', () => {
    expect(parseInterval('1d2h30m10s')).toBe(86400_000 + 7_200_000 + 1_800_000 + 10_000)
  })

  it('parses with spaces', () => {
    expect(parseInterval('2h 30m')).toBe(7_200_000 + 1_800_000)
  })

  it('is case insensitive', () => {
    expect(parseInterval('1D')).toBe(86400_000)
    expect(parseInterval('2H')).toBe(7_200_000)
  })

  it('returns null for invalid input', () => {
    expect(parseInterval('invalid')).toBeNull()
    expect(parseInterval('')).toBeNull()
    expect(parseInterval('abc')).toBeNull()
  })
})

describe('formatInterval', () => {
  it('formats days', () => {
    expect(formatInterval(86400_000)).toBe('1d')
  })

  it('formats hours', () => {
    expect(formatInterval(3_600_000)).toBe('1h')
  })

  it('formats combined', () => {
    expect(formatInterval(3_661_000)).toBe('1h1m1s')
  })

  it('formats zero as 0s', () => {
    expect(formatInterval(0)).toBe('0s')
  })

  it('formats complex durations', () => {
    expect(formatInterval(90_061_000)).toBe('1d1h1m1s')
  })
})
