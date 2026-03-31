import { describe, expect, test } from 'bun:test'
import { matchesRule, evaluatePermission } from '../../src/permissions/rules.js'
import type { PermissionRule } from '../../src/permissions/types.js'

describe('matchesRule', () => {
  test('matches exact tool name', () => {
    const rule: PermissionRule = { tool: 'Bash', decision: 'allow' }
    expect(matchesRule(rule, 'Bash', {})).toBe(true)
  })

  test('does not match different tool', () => {
    const rule: PermissionRule = { tool: 'Bash', decision: 'allow' }
    expect(matchesRule(rule, 'FileRead', {})).toBe(false)
  })

  test('matches with glob pattern on command', () => {
    const rule: PermissionRule = { tool: 'Bash', pattern: 'git *', decision: 'allow' }
    expect(matchesRule(rule, 'Bash', { command: 'git status' })).toBe(true)
    expect(matchesRule(rule, 'Bash', { command: 'rm -rf /' })).toBe(false)
  })
})

describe('evaluatePermission', () => {
  test('read-only tools are always allowed', () => {
    expect(evaluatePermission('FileRead', {}, true, { mode: 'default', rules: [], alwaysAllow: new Set() })).toBe('allow')
  })

  test('auto-approve mode allows everything', () => {
    expect(evaluatePermission('Bash', {}, false, { mode: 'auto-approve', rules: [], alwaysAllow: new Set() })).toBe('allow')
  })

  test('deny-all mode denies non-read tools', () => {
    expect(evaluatePermission('Bash', {}, false, { mode: 'deny-all', rules: [], alwaysAllow: new Set() })).toBe('deny')
  })

  test('alwaysAllow set is respected', () => {
    expect(evaluatePermission('Bash', {}, false, { mode: 'default', rules: [], alwaysAllow: new Set(['Bash']) })).toBe('allow')
  })
})
