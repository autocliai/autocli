import type { CommandDefinition } from './types.js'
import type { PermissionRule } from '../../services/permissions/types.js'

const USAGE = `Usage:
  /permissions                    — Show current permissions
  /permissions allow <tool> [pat] — Add an allow rule (optional glob pattern)
  /permissions deny <tool> [pat]  — Add a deny rule
  /permissions remove <number>    — Remove a rule by index
  /permissions reset              — Remove all rules and session allows
  /permissions mode <mode>        — Set mode: default | auto-approve | deny-all`

export const permissionsCommand: CommandDefinition = {
  name: 'permissions',
  description: 'View and manage tool permission rules',
  aliases: ['perms'],

  async execute(args, _context) {
    const parts = args.trim().split(/\s+/).filter(Boolean)
    const sub = parts[0]

    if (!sub) {
      // Return a signal for the REPL to handle (it has access to the live PermissionGate)
      return { type: 'permissions_show' }
    }

    if (sub === 'allow' || sub === 'deny') {
      const tool = parts[1]
      if (!tool) {
        return { output: `Missing tool name.\n\n${USAGE}` }
      }
      const pattern = parts[2] // optional glob
      const rule: PermissionRule = {
        tool,
        decision: sub === 'allow' ? 'allow' : 'deny',
        ...(pattern ? { pattern } : {}),
      }
      return { type: 'permissions_add_rule', rule }
    }

    if (sub === 'remove') {
      const idx = parseInt(parts[1], 10)
      if (isNaN(idx) || idx < 1) {
        return { output: `Invalid rule index. Use /permissions to see rule numbers.` }
      }
      return { type: 'permissions_remove_rule', index: idx - 1 }
    }

    if (sub === 'reset') {
      return { type: 'permissions_reset' }
    }

    if (sub === 'mode') {
      const mode = parts[1]
      if (!mode || !['default', 'auto-approve', 'deny-all', 'llm-confirm'].includes(mode)) {
        return { output: `Invalid mode. Choose: default, auto-approve, deny-all, llm-confirm` }
      }
      return { type: 'permissions_set_mode', mode }
    }

    return { output: `Unknown subcommand "${sub}".\n\n${USAGE}` }
  },
}
