// ── Client → Server messages ──

export interface AuthMessage {
  type: 'auth'
  token: string
}

export interface ChatMessage {
  type: 'chat'
  message: string
  sessionId?: string
  workingDir?: string
}

export type ControlAction = 'interrupt' | 'set_model' | 'set_permission_mode' | 'set_max_tokens'

export interface ControlMessage {
  type: 'control'
  action: ControlAction
  value?: string | number
}

export interface PingMessage {
  type: 'ping'
}

export type ClientMessage = AuthMessage | ChatMessage | ControlMessage | PingMessage

// ── Server → Client messages ──

export interface ConnectedMessage {
  type: 'connected'
  sessionId: string
}

export interface TextMessage {
  type: 'text'
  text: string
}

export interface ToolUseMessage {
  type: 'tool_use'
  name: string
  input: Record<string, unknown>
}

export interface ToolResultMessage {
  type: 'tool_result'
  name: string
  output: string
  isError: boolean
}

export interface DoneMessage {
  type: 'done'
  sessionId: string
  usage: { input: number; output: number; cost: string }
}

export interface InterruptedMessage {
  type: 'interrupted'
}

export interface ErrorMessage {
  type: 'error'
  message: string
}

export interface ControlAckMessage {
  type: 'control_ack'
  action: string
  success: boolean
  value?: unknown
  error?: string
}

export interface PongMessage {
  type: 'pong'
}

export type ServerMessage =
  | ConnectedMessage
  | TextMessage
  | ToolUseMessage
  | ToolResultMessage
  | DoneMessage
  | InterruptedMessage
  | ErrorMessage
  | ControlAckMessage
  | PongMessage

// ── Validation ──

const VALID_CLIENT_TYPES = new Set(['auth', 'chat', 'control', 'ping'])
const VALID_ACTIONS = new Set<ControlAction>(['interrupt', 'set_model', 'set_permission_mode', 'set_max_tokens'])
const VALID_PERMISSION_MODES = new Set(['default', 'auto-approve', 'deny-all'])

export function parseClientMessage(raw: string): { ok: true; msg: ClientMessage } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Invalid JSON' }
  }

  if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
    return { ok: false, error: 'Missing "type" field' }
  }

  const obj = parsed as Record<string, unknown>

  if (!VALID_CLIENT_TYPES.has(obj.type as string)) {
    return { ok: false, error: `Unknown message type: ${obj.type}` }
  }

  switch (obj.type) {
    case 'auth':
      if (typeof obj.token !== 'string' || !obj.token) {
        return { ok: false, error: 'auth: "token" must be a non-empty string' }
      }
      return { ok: true, msg: { type: 'auth', token: obj.token } }

    case 'chat':
      if (typeof obj.message !== 'string' || !obj.message) {
        return { ok: false, error: 'chat: "message" must be a non-empty string' }
      }
      return {
        ok: true,
        msg: {
          type: 'chat',
          message: obj.message,
          ...(typeof obj.sessionId === 'string' ? { sessionId: obj.sessionId } : {}),
          ...(typeof obj.workingDir === 'string' ? { workingDir: obj.workingDir } : {}),
        },
      }

    case 'control': {
      if (!VALID_ACTIONS.has(obj.action as ControlAction)) {
        return { ok: false, error: `control: unknown action "${obj.action}". Valid: ${[...VALID_ACTIONS].join(', ')}` }
      }
      const action = obj.action as ControlAction

      if (action === 'set_model') {
        if (typeof obj.value !== 'string' || !obj.value) {
          return { ok: false, error: 'set_model: "value" must be a non-empty string' }
        }
      }
      if (action === 'set_permission_mode') {
        if (!VALID_PERMISSION_MODES.has(obj.value as string)) {
          return { ok: false, error: `set_permission_mode: "value" must be one of: ${[...VALID_PERMISSION_MODES].join(', ')}` }
        }
      }
      if (action === 'set_max_tokens') {
        if (typeof obj.value !== 'number' || obj.value <= 0) {
          return { ok: false, error: 'set_max_tokens: "value" must be a positive number' }
        }
      }

      return {
        ok: true,
        msg: { type: 'control', action, value: obj.value as string | number | undefined },
      }
    }

    case 'ping':
      return { ok: true, msg: { type: 'ping' } }

    default:
      return { ok: false, error: `Unknown message type: ${obj.type}` }
  }
}
