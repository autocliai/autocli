export type EventType =
  | 'text' | 'text_done' | 'tool_call' | 'tool_result' | 'error'
  | 'agent_start' | 'agent_done' | 'approval_req' | 'approval_res' | 'status' | '*'

export type EventData = Record<string, unknown>
export type EventHandler = (data: EventData, type?: EventType) => void
