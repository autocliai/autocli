import type { CommandDefinition } from './types.js'
import type { PermissionRule, PermissionConfig } from '../permissions/types.js'
import { getGlobalEngine } from '../repl.js'

function formatRule(rule: PermissionRule, index: number): string {
  const pattern = rule.pattern ? ` (pattern: ${rule.pattern})` : ''
  return `  ${index + 1}. [${rule.decision}] ${rule.tool}${pattern}`
}

function formatConfig(config: PermissionConfig): string {
  const lines: string[] = []
  lines.push(`Mode: ${config.mode}`)

  const alwaysAllowList = Array.from(config.alwaysAllow)
  if (alwaysAllowList.length > 0) {
    lines.push(`\nAlways-allow (session): ${alwaysAllowList.join(', ')}`)
  }

  if (config.rules.length > 0) {
    lines.push('\nRules:')
    for (let i = 0; i < config.rules.length; i++) {
      lines.push(formatRule(config.rules[i], i))
    }
  } else {
    lines.push('\nNo custom rules configured.')
  }

  return lines.join('\n')
}

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

  async run(args, _context) {
    const engine = getGlobalEngine()
    if (!engine) {
      return { type: 'output', text: 'No active engine.' }
    }

    const config = engine.getPermissionConfig()
    const sub = args[0]

    // No subcommand: show current state
    if (!sub) {
      return { type: 'output', text: formatConfig(config) }
    }

    if (sub === 'allow' || sub === 'deny') {
      const tool = args[1]
      if (!tool) {
        return { type: 'output', text: `Missing tool name.\n\n${USAGE}` }
      }
      const pattern = args[2] // optional glob
      const rule: PermissionRule = {
        tool,
        decision: sub === 'allow' ? 'allow' : 'deny',
        ...(pattern ? { pattern } : {}),
      }
      config.rules.push(rule)
      const patternMsg = pattern ? ` with pattern "${pattern}"` : ''
      return { type: 'output', text: `Added ${sub} rule for "${tool}"${patternMsg}.` }
    }

    if (sub === 'remove') {
      const idx = parseInt(args[1], 10)
      if (isNaN(idx) || idx < 1 || idx > config.rules.length) {
        return { type: 'output', text: `Invalid rule index. Use /permissions to see rule numbers.` }
      }
      const removed = config.rules.splice(idx - 1, 1)[0]
      return { type: 'output', text: `Removed rule: [${removed.decision}] ${removed.tool}${removed.pattern ? ` (${removed.pattern})` : ''}` }
    }

    if (sub === 'reset') {
      config.rules.length = 0
      config.alwaysAllow.clear()
      return { type: 'output', text: 'All permission rules and session allows cleared.' }
    }

    if (sub === 'mode') {
      const mode = args[1]
      if (!mode || !['default', 'auto-approve', 'deny-all'].includes(mode)) {
        return { type: 'output', text: `Invalid mode. Choose: default, auto-approve, deny-all` }
      }
      engine.setPermissionMode(mode as 'default' | 'auto-approve' | 'deny-all')
      return { type: 'output', text: `Permission mode set to "${mode}".` }
    }

    return { type: 'output', text: `Unknown subcommand "${sub}".\n\n${USAGE}` }
  },
}
