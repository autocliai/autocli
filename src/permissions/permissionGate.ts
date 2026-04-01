import type { PermissionConfig } from './types.js'
import { evaluatePermission } from './rules.js'
import { promptPermission } from '../ui/permissionPrompt.js'
import { formatToolUse } from '../ui/toolResult.js'
import type { Wire } from '../wire/wire.js'

export class PermissionGate {
  private config: PermissionConfig
  wire: Wire | null = null

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

    // Emit approval request wire event
    const reqId = `approval-${Date.now()}`
    this.wire?.emit('approval_req', { id: reqId, tool: toolName, input })

    const description = formatToolUse(toolName, input)
    const answer = await promptPermission(toolName, description)

    // Emit approval response wire event
    this.wire?.emit('approval_res', { id: reqId, tool: toolName, answer })

    if (answer === 'always') {
      this.config.alwaysAllow.add(toolName)
      return true
    }

    return answer === 'yes'
  }

  addAlwaysAllow(toolName: string): void {
    this.config.alwaysAllow.add(toolName)
  }

  setMode(mode: PermissionConfig['mode']): void {
    this.config.mode = mode
  }
}
