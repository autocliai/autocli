import type { CommandDefinition } from './types.js'
import { theme } from '../ui/theme.js'
import { BrainStore } from '../../stores/brainStore.js'
import { platform } from '../../utils/platform.js'
import { join } from 'path'
import { renderMarkdown } from '../ui/markdown.js'

const BRAIN_DIR = join(platform.configDir, 'brain')

export const brainCommand: CommandDefinition = {
  name: 'brain',
  description: 'Manage Second Brain (show, search, stats)',

  async execute(args, _context) {
    const parts = args.trim().split(/\s+/).filter(Boolean)
    const sub = parts[0] || 'stats'
    const store = new BrainStore(BRAIN_DIR)

    switch (sub) {
      case 'stats': {
        const stats = store.getStats()
        return {
          output: [
            theme.bold('Second Brain:'),
            `  Total notes:  ${stats.total}`,
            `  Projects:     ${stats.byCategory.projects || 0}`,
            `  Areas:        ${stats.byCategory.areas || 0}`,
            `  Resources:    ${stats.byCategory.resources || 0}`,
            `  Archives:     ${stats.byCategory.archives || 0}`,
            '',
            theme.dim(`Location: ${BRAIN_DIR}`),
          ].join('\n'),
        }
      }

      case 'search': {
        const query = parts.slice(1).join(' ')
        if (!query) return { output: 'Usage: /brain search <query>' }
        const results = store.search(query, 10)
        if (results.length === 0) return { output: 'No matching notes found.' }
        return {
          output: results.map(r =>
            `${theme.bold(r.title)} [${r.category}]\n  ${theme.dim(r.content.slice(0, 150))}${r.content.length > 150 ? '...' : ''}`
          ).join('\n\n'),
        }
      }

      case 'show': {
        const allNotes = [
          ...store.listByCategory('projects'),
          ...store.listByCategory('areas'),
          ...store.listByCategory('resources'),
        ]
        if (allNotes.length === 0) return { output: 'No brain notes found.' }
        const summary = allNotes.slice(0, 10).map(n => `## ${n.title} (${n.category})\n${n.content.slice(0, 300)}`).join('\n\n')
        return { output: renderMarkdown(summary) }
      }

      case 'sync': {
        await store.sync()
        return { output: theme.success('Brain synced from markdown files.') }
      }

      default:
        return { output: 'Usage: /brain [stats|search <query>|show|sync]' }
    }
  },
}
