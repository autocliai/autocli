import type { CommandDefinition } from './types.js'
import { theme } from '../ui/theme.js'

export const helpCommand: CommandDefinition = {
  name: 'help',
  description: 'Show available commands',
  aliases: ['h', '?'],

  async execute(_args, _context) {
    return {
      output: [
        theme.bold('Available commands:'),
        '',
        '  /help        Show this help',
        '  /review      Review code changes (staged or unstaged)',
        '  /plan        Toggle plan mode (read-only)',
        '  /yolo        Toggle auto-approve mode',
        '  /tasks       List background subprocess tasks',
        '  /skills      List available skills',
        '  /activate <key> Activate license key',
        '  /doctor      Diagnose environment issues',
        '  /team        Show team status and worker progress',
        '  /brain [cmd]  Second Brain (stats, search, show, sync)',
        '  /permissions  View and manage tool permission rules (alias: /perms)',
        '  /agents      Manage agent definitions',
        '  /schedule    Manage scheduled team runs',
        '  /deploy      Deploy team blueprints',
        '  /status      Show full status (teams, tasks, schedules)',
        '',
        theme.dim('Type a message to chat, or /command to run a command.'),
      ].join('\n'),
    }
  },
}
