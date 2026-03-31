import type { PermissionConfig, PermissionDecision, PermissionRule } from './types.js'

export function matchesRule(
  rule: PermissionRule,
  toolName: string,
  input: Record<string, unknown>,
): boolean {
  if (rule.tool !== toolName) return false
  if (!rule.pattern) return true

  const firstStringVal = Object.values(input).find(v => typeof v === 'string') as string | undefined
  if (!firstStringVal) return false

  return globMatch(rule.pattern, firstStringVal)
}

function globMatch(pattern: string, value: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${regex}$`).test(value)
}

export function evaluatePermission(
  toolName: string,
  input: Record<string, unknown>,
  isReadOnly: boolean,
  config: PermissionConfig,
): PermissionDecision {
  if (isReadOnly) return 'allow'
  if (config.mode === 'auto-approve') return 'allow'
  if (config.mode === 'deny-all') return 'deny'
  if (config.alwaysAllow.has(toolName)) return 'allow'

  for (const rule of config.rules) {
    if (matchesRule(rule, toolName, input)) return rule.decision
  }

  return 'ask'
}
