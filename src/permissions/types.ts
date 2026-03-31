export type PermissionDecision = 'allow' | 'deny' | 'ask'

export interface PermissionRule {
  tool: string
  pattern?: string
  decision: PermissionDecision
}

export interface PermissionConfig {
  mode: 'default' | 'auto-approve' | 'deny-all'
  rules: PermissionRule[]
  alwaysAllow: Set<string>
}
