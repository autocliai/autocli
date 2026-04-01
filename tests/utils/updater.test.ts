import { describe, expect, test } from 'bun:test'
import { checkForUpdate, showUpdateNotice } from '../../src/utils/updater.js'

describe('updater', () => {
  test('checkForUpdate returns null or string', async () => {
    // Will likely return null due to rate limiting or network failure in test
    const result = await checkForUpdate()
    expect(result === null || typeof result === 'string').toBe(true)
  })

  test('showUpdateNotice does not throw', () => {
    expect(() => showUpdateNotice('1.0.0')).not.toThrow()
  })
})
