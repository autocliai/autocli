import { describe, expect, test } from 'bun:test'
import { bashTool } from '../../src/tools/bash.js'

describe('bashTool', () => {
  test('executes simple command', async () => {
    const result = await bashTool.call(
      { command: 'echo hello' },
      { workingDir: '/tmp' }
    )
    expect(result.output).toContain('hello')
  })

  test('returns stderr on failure', async () => {
    const result = await bashTool.call(
      { command: 'ls /nonexistent_dir_12345' },
      { workingDir: '/tmp' }
    )
    expect(result.isError).toBe(true)
  })

  test('respects timeout', async () => {
    const result = await bashTool.call(
      { command: 'sleep 10', timeout: 500 },
      { workingDir: '/tmp' }
    )
    expect(result.isError).toBe(true)
    expect(result.output).toContain('timed out')
  })
})
