import type { CommandDefinition } from './types.js'

export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>()
  private aliases = new Map<string, string>()

  register(cmd: CommandDefinition): void {
    this.commands.set(cmd.name, cmd)
    for (const alias of cmd.aliases || []) {
      this.aliases.set(alias, cmd.name)
    }
  }

  get(nameOrAlias: string): CommandDefinition | undefined {
    return this.commands.get(nameOrAlias) || this.commands.get(this.aliases.get(nameOrAlias) || '')
  }

  list(): CommandDefinition[] {
    return Array.from(this.commands.values())
  }

  parse(input: string): { name: string; args: string[] } | undefined {
    if (!input.startsWith('/')) return undefined
    const trimmed = input.slice(1).trim()
    if (!trimmed) return undefined

    // Extract command name
    const spaceIdx = trimmed.indexOf(' ')
    if (spaceIdx === -1) return { name: trimmed, args: [] }

    const name = trimmed.slice(0, spaceIdx)
    const rest = trimmed.slice(spaceIdx + 1).trim()
    if (!rest) return { name, args: [] }

    // Quote-aware argument splitting
    const args: string[] = []
    let current = ''
    let inQuote = false
    let quoteChar = ''

    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i]
      if ((ch === '"' || ch === "'") && !inQuote) {
        inQuote = true
        quoteChar = ch
      } else if (ch === quoteChar && inQuote) {
        inQuote = false
        quoteChar = ''
      } else if (ch === ' ' && !inQuote) {
        if (current) { args.push(current); current = '' }
      } else {
        current += ch
      }
    }
    if (current) args.push(current)

    return { name, args }
  }
}
