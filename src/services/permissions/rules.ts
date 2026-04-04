import type { PermissionDecision, PermissionConfig } from './types.js'

export function evaluatePermission(
  toolName: string, input: Record<string, unknown>, isReadOnly: boolean, config: PermissionConfig,
): PermissionDecision {
  if (isReadOnly) return 'allow'
  if (config.mode === 'auto-approve') return 'allow'
  if (config.mode === 'deny-all') return 'deny'
  if (config.alwaysAllow.has(toolName)) return 'allow'
  if (config.mode === 'llm-confirm') return 'llm-confirm'

  for (const rule of config.rules) {
    if (rule.tool !== toolName && rule.tool !== '*') continue
    if (rule.pattern) {
      const firstStr = findFirstString(input)
      if (firstStr && matchGlob(rule.pattern, firstStr)) return rule.decision
    } else {
      return rule.decision
    }
  }
  return 'ask'
}

function findFirstString(input: Record<string, unknown>): string | undefined {
  for (const value of Object.values(input)) {
    if (typeof value === 'string') return value
  }
  return undefined
}

function matchGlob(pattern: string, str: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
  return regex.test(str)
}
