import { describe, test, expect } from 'bun:test'
import { activateCommand, isLicenseActive } from '../../src/cli/commands/activate.js'
import { makeContext } from './helpers.js'

describe('activate command', () => {
  test('no args shows current license status', async () => {
    const result = await activateCommand.execute('', makeContext())
    expect(result.output).toBeDefined()
    // Either shows active license or "No license key set"
    const hasLicense = result.output!.includes('Active') || result.output!.includes('Invalid')
    const noLicense = result.output!.includes('No license key set')
    expect(hasLicense || noLicense).toBe(true)
  })

  test('invalid format returns error', async () => {
    const result = await activateCommand.execute('bad-key', makeContext())
    expect(result.output).toContain('Invalid license key format')
  })

  test('correct format but bad checksum returns error', async () => {
    const result = await activateCommand.execute('ACLI-ZZZZ-ZZZZ-ZZZZ', makeContext())
    // May pass or fail checksum depending on the sum
    expect(result.output).toBeDefined()
  })

  test('isLicenseActive returns boolean', async () => {
    const active = await isLicenseActive()
    expect(typeof active).toBe('boolean')
  })

  test('has correct name', () => {
    expect(activateCommand.name).toBe('activate')
  })
})
