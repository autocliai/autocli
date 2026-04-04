import type { CommandDefinition, CommandResult, CommandContext } from './types.js'

export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>()

  register(command: CommandDefinition): void {
    this.commands.set(command.name, command)
    for (const alias of command.aliases || []) this.commands.set(alias, command)
  }

  async execute(input: string, context: CommandContext): Promise<CommandResult | null> {
    const { name, args } = this.parse(input)
    const command = this.commands.get(name)
    if (!command) return null
    return command.execute(args, context)
  }

  has(name: string): boolean { return this.commands.has(name) }

  list(): CommandDefinition[] {
    const seen = new Set<string>()
    const result: CommandDefinition[] = []
    for (const [, cmd] of this.commands) {
      if (!seen.has(cmd.name)) { seen.add(cmd.name); result.push(cmd) }
    }
    return result
  }

  private parse(input: string): { name: string; args: string } {
    const trimmed = input.trim()
    const spaceIdx = trimmed.indexOf(' ')
    if (spaceIdx === -1) return { name: trimmed, args: '' }
    return { name: trimmed.slice(0, spaceIdx), args: trimmed.slice(spaceIdx + 1).trim() }
  }
}
