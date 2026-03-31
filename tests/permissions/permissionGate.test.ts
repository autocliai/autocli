import { describe, expect, test } from 'bun:test'
import { PermissionGate } from '../../src/permissions/permissionGate.js'

describe('PermissionGate', () => {
  test('allows read-only tools without prompting', async () => {
    const gate = new PermissionGate({ mode: 'default', rules: [], alwaysAllow: new Set() })
    const result = await gate.check('FileRead', {}, true)
    expect(result).toBe(true)
  })

  test('remembers always-allow decisions', async () => {
    const gate = new PermissionGate({ mode: 'default', rules: [], alwaysAllow: new Set() })
    gate.addAlwaysAllow('Bash')
    const result = await gate.check('Bash', {}, false)
    expect(result).toBe(true)
  })
})
