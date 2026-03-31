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
    const parts = input.slice(1).split(/\s+/)
    const name = parts[0]
    const args = parts.slice(1)
    return { name, args }
  }
}
