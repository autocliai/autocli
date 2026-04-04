import type { CommandDefinition } from './types.js'

export const yoloCommand: CommandDefinition = {
  name: 'yolo',
  description: 'Toggle YOLO mode (auto-approve all tool calls)',

  async execute(_args, _context) {
    return { type: 'yolo_toggle' }
  },
}
