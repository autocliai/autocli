import { describe, expect, test } from 'bun:test'
// Dialog functions require interactive stdin, so we test the module loads correctly
import * as dialog from '../../src/ui/dialog.js'

describe('dialog module', () => {
  test('exports showDialog function', () => {
    expect(typeof dialog.showDialog).toBe('function')
  })

  test('exports showConfirm function', () => {
    expect(typeof dialog.showConfirm).toBe('function')
  })

  test('exports showAlert function', () => {
    expect(typeof dialog.showAlert).toBe('function')
  })
})
