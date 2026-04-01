import type { CommandDefinition } from './types.js'
import { SessionStore } from '../session/sessionStore.js'
import { platform } from '../utils/platform.js'
import { theme } from '../ui/theme.js'
import { join } from 'path'

export const sessionsCommand: CommandDefinition = {
  name: 'sessions',
  description: 'List saved sessions',
  aliases: ['resume-list'],
  async run(_args, _context) {
    const store = new SessionStore(join(platform.configDir, 'sessions'))
    const list = store.list()

    if (list.length === 0) return 'No saved sessions.'

    const lines = list.slice(0, 20).map(s => {
      const date = new Date(s.updatedAt).toLocaleDateString()
      const time = new Date(s.updatedAt).toLocaleTimeString()
      return `  ${theme.bold(s.id)} ${theme.dim(`${date} ${time}`)} ${s.messageCount} msgs ${theme.dim(s.workingDir)}`
    })

    return [
      theme.bold('Saved sessions:'),
      '',
      ...lines,
      '',
      theme.dim('Resume with: mini-claude --resume <id>'),
    ].join('\n')
  },
}
