import type { CommandDefinition } from './types.js'
import { theme } from '../ui/theme.js'

export const helpCommand: CommandDefinition = {
  name: 'help',
  description: 'Show available commands',
  aliases: ['h', '?'],

  async run(_args, _context) {
    return [
      theme.bold('Available commands:'),
      '',
      '  /help        Show this help',
      '  /cost        Show token usage and cost',
      '  /diff        Show git diff',
      '  /commit      Create a git commit',
      '  /compact     Compact conversation context',
      '  /review      Review code changes (staged or unstaged)',
      '  /init        Initialize .claude/ directory and CLAUDE.md',
      '  /export      Export conversation to markdown file',
      '  /plan        Toggle plan mode (read-only)',
      '  /model <name> Switch model (sonnet, opus, haiku)',
      '  /yolo        Toggle auto-approve mode',
      '  /tasks       List background subprocess tasks',
      '  /skills      List available skills',
      '  /activate <key> Activate license key',
      '  /context     Show context window usage',
      '  /doctor      Diagnose environment issues',
      '  /rewind [n]  Undo last N conversation turns (alias: /undo)',
      '  /copy        Copy last assistant response to clipboard',
      '  /vim         Toggle vim keybinding mode',
      '  /team        Show team status and worker progress',
      '  /brain [cmd]  Second Brain (stats, search, show, distill)',
      '  /search <q>  Search conversation transcript (aliases: /find, /grep)',
      '  /permissions  View and manage tool permission rules (alias: /perms)',
      '',
      theme.dim('Type a message to chat, or /command to run a command.'),
    ].join('\n')
  },
}
