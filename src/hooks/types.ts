export type HookEvent =
  | 'before_tool_call'
  | 'after_tool_call'
  | 'before_response'
  | 'after_response'
  | 'on_error'

export interface HookDefinition {
  event: HookEvent
  command: string
  pattern?: string
}

export interface HookResult {
  exitCode: number
  stdout: string
  stderr: string
  blocked: boolean
}
