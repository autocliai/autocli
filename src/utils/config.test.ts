import { describe, it, expect } from 'bun:test'
import { modelDisplayName, resolveModel, MODEL_MAP } from './config.js'

describe('modelDisplayName', () => {
  it('returns "claude (local)" for claude-local', () => {
    expect(modelDisplayName('claude-local')).toBe('claude (local)')
  })

  it('returns miniMax model as-is', () => {
    expect(modelDisplayName('miniMax-2.7')).toBe('miniMax-2.7')
  })

  it('extracts opus 4.6 from model ID', () => {
    expect(modelDisplayName('claude-opus-4-6-20250616')).toBe('opus 4.6')
  })

  it('extracts sonnet 4 from model ID', () => {
    expect(modelDisplayName('claude-sonnet-4-20250514')).toBe('sonnet 4')
  })

  it('extracts haiku 3.5 from model ID', () => {
    expect(modelDisplayName('claude-haiku-3-5-20241022')).toBe('haiku 3.5')
  })

  it('returns unknown model as-is', () => {
    expect(modelDisplayName('gpt-4o')).toBe('gpt-4o')
  })
})

describe('resolveModel', () => {
  it('resolves known aliases', () => {
    expect(resolveModel('sonnet', 'default')).toBe('claude-sonnet-4-20250514')
    expect(resolveModel('opus', 'default')).toBe('claude-opus-4-6-20250616')
    expect(resolveModel('haiku', 'default')).toBe('claude-haiku-4-5-20251001')
  })

  it('returns unknown name as-is', () => {
    expect(resolveModel('gpt-4o', 'default')).toBe('gpt-4o')
  })

  it('returns fallback for empty name', () => {
    expect(resolveModel('', 'my-fallback')).toBe('my-fallback')
  })
})

describe('MODEL_MAP', () => {
  it('has expected keys', () => {
    expect(MODEL_MAP).toHaveProperty('sonnet')
    expect(MODEL_MAP).toHaveProperty('opus')
    expect(MODEL_MAP).toHaveProperty('haiku')
    expect(MODEL_MAP).toHaveProperty('local')
    expect(MODEL_MAP).toHaveProperty('minimax')
  })
})
