import { describe, test, expect } from 'bun:test'
import { doctorCommand } from '../../src/cli/commands/doctor.js'
import { makeContext } from './helpers.js'

describe('doctor command', () => {
  test('returns diagnostic output', async () => {
    const result = await doctorCommand.execute('', makeContext())
    expect(result.output).toBeDefined()
    expect(result.output).toContain('Environment Diagnostics')
  })

  test('checks API key', async () => {
    const result = await doctorCommand.execute('', makeContext())
    expect(result.output).toContain('API Key')
  })

  test('checks git', async () => {
    const result = await doctorCommand.execute('', makeContext())
    expect(result.output).toContain('Git')
  })

  test('checks Bun version', async () => {
    const result = await doctorCommand.execute('', makeContext())
    expect(result.output).toContain('Bun')
  })

  test('checks platform', async () => {
    const result = await doctorCommand.execute('', makeContext())
    expect(result.output).toContain('Platform')
  })

  test('checks shell', async () => {
    const result = await doctorCommand.execute('', makeContext())
    expect(result.output).toContain('Shell')
  })

  test('checks terminal size', async () => {
    const result = await doctorCommand.execute('', makeContext())
    expect(result.output).toContain('Terminal')
  })

  test('checks license', async () => {
    const result = await doctorCommand.execute('', makeContext())
    expect(result.output).toContain('License')
  })

  test('has correct name', () => {
    expect(doctorCommand.name).toBe('doctor')
  })
})
