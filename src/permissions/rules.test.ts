import { describe, it, expect } from 'bun:test'
import { matchesRule, evaluatePermission } from './rules.js'
import type { PermissionConfig, PermissionRule } from './types.js'

describe('matchesRule', () => {
  it('matches tool name without pattern', () => {
    const rule: PermissionRule = { tool: 'bash', decision: 'allow' }
    expect(matchesRule(rule, 'bash', {})).toBe(true)
  })

  it('rejects non-matching tool name', () => {
    const rule: PermissionRule = { tool: 'bash', decision: 'allow' }
    expect(matchesRule(rule, 'read', {})).toBe(false)
  })

  it('matches glob pattern against first string value', () => {
    const rule: PermissionRule = { tool: 'read', pattern: '*.ts', decision: 'allow' }
    expect(matchesRule(rule, 'read', { path: 'file.ts' })).toBe(true)
    expect(matchesRule(rule, 'read', { path: 'file.js' })).toBe(false)
  })

  it('supports ? wildcard', () => {
    const rule: PermissionRule = { tool: 'read', pattern: 'file.?s', decision: 'allow' }
    expect(matchesRule(rule, 'read', { path: 'file.ts' })).toBe(true)
    expect(matchesRule(rule, 'read', { path: 'file.js' })).toBe(true)
    expect(matchesRule(rule, 'read', { path: 'file.css' })).toBe(false)
  })

  it('returns false when input has no string values', () => {
    const rule: PermissionRule = { tool: 'bash', pattern: '*.sh', decision: 'allow' }
    expect(matchesRule(rule, 'bash', { count: 5 })).toBe(false)
  })

  it('matches wildcard * pattern', () => {
    const rule: PermissionRule = { tool: 'read', pattern: '/src/*', decision: 'allow' }
    expect(matchesRule(rule, 'read', { path: '/src/index.ts' })).toBe(true)
    expect(matchesRule(rule, 'read', { path: '/lib/index.ts' })).toBe(false)
  })
})

describe('evaluatePermission', () => {
  const baseConfig: PermissionConfig = {
    mode: 'default',
    rules: [],
    alwaysAllow: new Set(),
  }

  it('allows read-only tools', () => {
    expect(evaluatePermission('read', {}, true, baseConfig)).toBe('allow')
  })

  it('allows everything in auto-approve mode', () => {
    const config = { ...baseConfig, mode: 'auto-approve' as const }
    expect(evaluatePermission('bash', {}, false, config)).toBe('allow')
  })

  it('denies everything in deny-all mode', () => {
    const config = { ...baseConfig, mode: 'deny-all' as const }
    expect(evaluatePermission('bash', {}, false, config)).toBe('deny')
  })

  it('allows tools in alwaysAllow set', () => {
    const config = { ...baseConfig, alwaysAllow: new Set(['bash']) }
    expect(evaluatePermission('bash', {}, false, config)).toBe('allow')
  })

  it('returns matching rule decision', () => {
    const config: PermissionConfig = {
      ...baseConfig,
      rules: [{ tool: 'bash', decision: 'deny' }],
    }
    expect(evaluatePermission('bash', {}, false, config)).toBe('deny')
  })

  it('returns ask when no rules match', () => {
    expect(evaluatePermission('bash', {}, false, baseConfig)).toBe('ask')
  })

  it('checks rules in order, returns first match', () => {
    const config: PermissionConfig = {
      ...baseConfig,
      rules: [
        { tool: 'bash', pattern: '*.sh', decision: 'allow' },
        { tool: 'bash', decision: 'deny' },
      ],
    }
    expect(evaluatePermission('bash', { cmd: 'run.sh' }, false, config)).toBe('allow')
    expect(evaluatePermission('bash', { cmd: 'run.py' }, false, config)).toBe('deny')
  })
})
