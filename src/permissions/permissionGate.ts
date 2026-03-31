import type { PermissionConfig } from './types.js'
import { evaluatePermission } from './rules.js'
import { promptPermission } from '../ui/permissionPrompt.js'
import { formatToolUse } from '../ui/toolResult.js'

export class PermissionGate {
  private config: PermissionConfig

  constructor(config: PermissionConfig) {
    this.config = config
  }

  async check(
    toolName: string,
    input: Record<string, unknown>,
    isReadOnly: boolean,
  ): Promise<boolean> {
    const decision = evaluatePermission(toolName, input, isReadOnly, this.config)

    if (decision === 'allow') return true
    if (decision === 'deny') return false

    const description = formatToolUse(toolName, input)
    const answer = await promptPermission(toolName, description)

    if (answer === 'always') {
      this.config.alwaysAllow.add(toolName)
      return true
    }

    return answer === 'yes'
  }

  addAlwaysAllow(toolName: string): void {
    this.config.alwaysAllow.add(toolName)
  }
}
