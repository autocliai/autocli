export type PermissionMode = 'default' | 'auto-approve' | 'deny-all' | 'llm-confirm'
export type PermissionDecision = 'allow' | 'deny' | 'ask' | 'llm-confirm'

export interface PermissionRule {
  tool: string
  pattern?: string
  decision: PermissionDecision
}

export interface PermissionConfig {
  mode: PermissionMode
  rules: PermissionRule[]
  alwaysAllow: Set<string>
}
