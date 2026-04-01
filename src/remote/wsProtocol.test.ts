import { describe, it, expect } from 'bun:test'
import { parseClientMessage } from './wsProtocol.js'

describe('parseClientMessage', () => {
  describe('invalid input', () => {
    it('rejects invalid JSON', () => {
      const result = parseClientMessage('not json')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('Invalid JSON')
    })

    it('rejects missing type field', () => {
      const result = parseClientMessage('{"token":"abc"}')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('type')
    })

    it('rejects unknown message type', () => {
      const result = parseClientMessage('{"type":"foo"}')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('Unknown message type')
    })

    it('rejects non-object', () => {
      const result = parseClientMessage('"hello"')
      expect(result.ok).toBe(false)
    })

    it('rejects null', () => {
      const result = parseClientMessage('null')
      expect(result.ok).toBe(false)
    })
  })

  describe('auth messages', () => {
    it('parses valid auth', () => {
      const result = parseClientMessage('{"type":"auth","token":"Bearer xyz"}')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.msg.type).toBe('auth')
        if (result.msg.type === 'auth') expect(result.msg.token).toBe('Bearer xyz')
      }
    })

    it('rejects auth without token', () => {
      const result = parseClientMessage('{"type":"auth"}')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('token')
    })

    it('rejects auth with empty token', () => {
      const result = parseClientMessage('{"type":"auth","token":""}')
      expect(result.ok).toBe(false)
    })
  })

  describe('chat messages', () => {
    it('parses valid chat', () => {
      const result = parseClientMessage('{"type":"chat","message":"hello"}')
      expect(result.ok).toBe(true)
      if (result.ok && result.msg.type === 'chat') {
        expect(result.msg.message).toBe('hello')
      }
    })

    it('parses chat with optional fields', () => {
      const result = parseClientMessage('{"type":"chat","message":"hi","sessionId":"abc","workingDir":"/tmp"}')
      expect(result.ok).toBe(true)
      if (result.ok && result.msg.type === 'chat') {
        expect(result.msg.sessionId).toBe('abc')
        expect(result.msg.workingDir).toBe('/tmp')
      }
    })

    it('rejects chat without message', () => {
      const result = parseClientMessage('{"type":"chat"}')
      expect(result.ok).toBe(false)
    })

    it('rejects chat with empty message', () => {
      const result = parseClientMessage('{"type":"chat","message":""}')
      expect(result.ok).toBe(false)
    })
  })

  describe('control messages', () => {
    it('parses interrupt (no value needed)', () => {
      const result = parseClientMessage('{"type":"control","action":"interrupt"}')
      expect(result.ok).toBe(true)
      if (result.ok && result.msg.type === 'control') {
        expect(result.msg.action).toBe('interrupt')
      }
    })

    it('parses set_model', () => {
      const result = parseClientMessage('{"type":"control","action":"set_model","value":"sonnet"}')
      expect(result.ok).toBe(true)
      if (result.ok && result.msg.type === 'control') {
        expect(result.msg.value).toBe('sonnet')
      }
    })

    it('rejects set_model without value', () => {
      const result = parseClientMessage('{"type":"control","action":"set_model"}')
      expect(result.ok).toBe(false)
    })

    it('parses set_permission_mode', () => {
      const result = parseClientMessage('{"type":"control","action":"set_permission_mode","value":"auto-approve"}')
      expect(result.ok).toBe(true)
    })

    it('rejects set_permission_mode with invalid value', () => {
      const result = parseClientMessage('{"type":"control","action":"set_permission_mode","value":"yolo"}')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('default')
    })

    it('parses set_max_tokens', () => {
      const result = parseClientMessage('{"type":"control","action":"set_max_tokens","value":4096}')
      expect(result.ok).toBe(true)
      if (result.ok && result.msg.type === 'control') {
        expect(result.msg.value).toBe(4096)
      }
    })

    it('rejects set_max_tokens with non-positive', () => {
      const result = parseClientMessage('{"type":"control","action":"set_max_tokens","value":-1}')
      expect(result.ok).toBe(false)
    })

    it('rejects set_max_tokens with string value', () => {
      const result = parseClientMessage('{"type":"control","action":"set_max_tokens","value":"big"}')
      expect(result.ok).toBe(false)
    })

    it('rejects unknown action', () => {
      const result = parseClientMessage('{"type":"control","action":"self_destruct"}')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('unknown action')
    })
  })

  describe('ping messages', () => {
    it('parses ping', () => {
      const result = parseClientMessage('{"type":"ping"}')
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.msg.type).toBe('ping')
    })
  })
})
