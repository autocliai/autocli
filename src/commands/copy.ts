import type { CommandDefinition } from './types.js'
import { theme } from '../ui/theme.js'

export const copyCommand: CommandDefinition = {
  name: 'copy',
  description: 'Copy last assistant response to clipboard',

  async run(_args, context) {
    // Find last assistant message
    for (let i = context.messages.length - 1; i >= 0; i--) {
      const msg = context.messages[i]
      if (msg.role !== 'assistant') continue

      let text: string
      if (typeof msg.content === 'string') {
        text = msg.content
      } else {
        text = msg.content
          .filter(b => b.type === 'text')
          .map(b => (b as { text: string }).text)
          .join('\n')
      }

      if (!text) continue

      // Try clipboard commands
      try {
        const cmd = process.platform === 'darwin' ? 'pbcopy'
          : process.platform === 'win32' ? 'clip'
          : 'xclip -selection clipboard'
        const proc = Bun.spawn(['bash', '-c', `echo ${JSON.stringify(text)} | ${cmd}`], { stdout: 'pipe', stderr: 'pipe' })
        await proc.exited
        return theme.success(`Copied ${text.length} characters to clipboard.`)
      } catch {
        return theme.error('Clipboard not available. Install xclip or xsel.')
      }
    }

    return 'No assistant response to copy.'
  },
}
