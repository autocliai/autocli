import { describe, expect, test } from 'bun:test'
import { Spinner } from '../../src/ui/spinner.js'

describe('Spinner', () => {
  test('can be created with a message', () => {
    const spinner = new Spinner('Loading...')
    expect(spinner.message).toBe('Loading...')
    expect(spinner.isRunning).toBe(false)
  })

  test('can update message', () => {
    const spinner = new Spinner('Loading...')
    spinner.update('Still loading...')
    expect(spinner.message).toBe('Still loading...')
  })

  test('start and stop toggle state', () => {
    const spinner = new Spinner('test')
    spinner.start()
    expect(spinner.isRunning).toBe(true)
    spinner.stop()
    expect(spinner.isRunning).toBe(false)
  })
})
