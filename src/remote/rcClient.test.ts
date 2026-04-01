import { describe, it, expect, beforeEach } from 'bun:test'
import { RCClient } from './rcClient.js'

describe('RCClient', () => {
  let client: RCClient

  beforeEach(() => {
    client = new RCClient({
      serverUrl: 'https://example.com',
      apiKey: 'sk-eclaw-test',
    })
  })

  describe('constructor', () => {
    it('creates with config', () => {
      expect(client).toBeDefined()
      expect(client.getSession()).toBeNull()
      expect(client.isActive()).toBe(false)
    })
  })

  describe('getSession', () => {
    it('returns null before start', () => {
      expect(client.getSession()).toBeNull()
    })
  })

  describe('isActive', () => {
    it('returns false before start', () => {
      expect(client.isActive()).toBe(false)
    })
  })

  describe('stop', () => {
    it('does not throw when no session', async () => {
      await client.stop()
      expect(client.getSession()).toBeNull()
    })
  })

  describe('pushEvent', () => {
    it('does not throw when no session', async () => {
      // Should silently return since no session
      await client.pushEvent('text', { content: 'hello' })
    })
  })

  describe('connectWire', () => {
    it('throws when no session started', () => {
      const fakeWire = { on: () => {}, off: () => {} } as any
      expect(() => client.connectWire(fakeWire)).toThrow('Session not started')
    })
  })

  describe('pollInput', () => {
    it('throws when no session started', async () => {
      const iter = client.pollInput()
      try {
        await iter.next()
        expect(true).toBe(false) // should not reach
      } catch (err) {
        expect((err as Error).message).toContain('Session not started')
      }
    })
  })
})
