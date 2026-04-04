import { describe, test, expect } from 'bun:test'
import { yoloCommand } from '../../src/cli/commands/yolo.js'
import { makeContext } from './helpers.js'

describe('yolo command', () => {
  test('returns yolo_toggle type', async () => {
    const result = await yoloCommand.execute('', makeContext())
    expect(result.type).toBe('yolo_toggle')
  })

  test('has correct name', () => {
    expect(yoloCommand.name).toBe('yolo')
  })
})
