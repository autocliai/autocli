import { describe, it, expect } from 'bun:test'
import { formatError, formatWarning, formatInfo, formatSuccess } from './errorFormat.js'

describe('formatError', () => {
  it('contains the message', () => {
    expect(formatError('something broke')).toContain('something broke')
  })

  it('contains Error indicator', () => {
    expect(formatError('oops')).toContain('Error')
  })
})

describe('formatWarning', () => {
  it('contains the message', () => {
    expect(formatWarning('be careful')).toContain('be careful')
  })

  it('contains Warning indicator', () => {
    expect(formatWarning('watch out')).toContain('Warning')
  })
})

describe('formatInfo', () => {
  it('contains the message', () => {
    expect(formatInfo('FYI')).toContain('FYI')
  })

  it('contains Info indicator', () => {
    expect(formatInfo('note')).toContain('Info')
  })
})

describe('formatSuccess', () => {
  it('contains the message', () => {
    expect(formatSuccess('all good')).toContain('all good')
  })
})
