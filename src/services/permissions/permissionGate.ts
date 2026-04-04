import type { PermissionConfig, PermissionMode } from './types.js'
import { evaluatePermission } from './rules.js'
import { llmConfirmTool } from './llmConfirm.js'
import type { EventBus } from '../events/eventBus.js'
import type { LLMProvider } from '../providers/types.js'

export class PermissionGate {
  private config: PermissionConfig
  private eventBus: EventBus
  private provider?: LLMProvider
  private promptFn: (toolName: string, input: Record<string, unknown>) => Promise<boolean>

  constructor(
    mode: PermissionMode, eventBus: EventBus,
    promptFn: (toolName: string, input: Record<string, unknown>) => Promise<boolean>,
    provider?: LLMProvider,
  ) {
    this.config = { mode, rules: [], alwaysAllow: new Set() }
    this.eventBus = eventBus
    this.promptFn = promptFn
    this.provider = provider
  }

  async check(toolName: string, input: Record<string, unknown>, isReadOnly: boolean, planMode: boolean): Promise<boolean> {
    if (planMode && !isReadOnly) {
      this.eventBus.emit('approval_res', { tool: toolName, allowed: false, reason: 'plan_mode' })
      return false
    }
    const decision = evaluatePermission(toolName, input, isReadOnly, this.config)
    switch (decision) {
      case 'allow': return true
      case 'deny':
        this.eventBus.emit('approval_res', { tool: toolName, allowed: false, reason: 'denied' })
        return false
      case 'llm-confirm':
        if (!this.provider) return false
        this.eventBus.emit('approval_req', { tool: toolName, input, method: 'llm' })
        const llmResult = await llmConfirmTool(this.provider, toolName, input)
        this.eventBus.emit('approval_res', { tool: toolName, allowed: llmResult })
        return llmResult
      case 'ask': default:
        this.eventBus.emit('approval_req', { tool: toolName, input, method: 'user' })
        const allowed = await this.promptFn(toolName, input)
        this.eventBus.emit('approval_res', { tool: toolName, allowed })
        return allowed
    }
  }

  setMode(mode: PermissionMode): void { this.config.mode = mode }
  addRule(rule: { tool: string; pattern?: string; decision: 'allow' | 'deny' }): void { this.config.rules.push(rule) }
  removeRule(tool: string): void { this.config.rules = this.config.rules.filter(r => r.tool !== tool) }
  addAlwaysAllow(tool: string): void { this.config.alwaysAllow.add(tool) }
  get mode(): PermissionMode { return this.config.mode }
}
