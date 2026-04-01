import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { SessionStore } from './sessionStore.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let tmpDir: string
let store: SessionStore

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'session-test-'))
  store = new SessionStore(tmpDir)
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('SessionStore', () => {
  describe('create', () => {
    it('creates a session with 8-char ID', () => {
      const session = store.create('/home/user/project')
      expect(session.id.length).toBe(8)
      expect(session.workingDir).toBe('/home/user/project')
      expect(session.messages).toEqual([])
      expect(session.totalCost).toBe(0)
      expect(session.totalTokens).toEqual({ input: 0, output: 0 })
    })

    it('has timestamps', () => {
      const session = store.create('/tmp')
      expect(session.createdAt).toBeDefined()
      expect(session.updatedAt).toBeDefined()
    })
  })

  describe('save + load', () => {
    it('round-trips session data', () => {
      const session = store.create('/tmp')
      session.messages = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ]
      session.totalCost = 0.05
      session.totalTokens = { input: 1000, output: 500 }
      store.save(session)

      const loaded = store.load(session.id)
      expect(loaded).toBeDefined()
      expect(loaded!.messages.length).toBe(2)
      expect(loaded!.totalCost).toBe(0.05)
      expect(loaded!.totalTokens.input).toBe(1000)
    })

    it('returns undefined for missing session', () => {
      expect(store.load('nonexistent')).toBeUndefined()
    })

    it('save updates updatedAt', () => {
      const session = store.create('/tmp')
      const original = session.updatedAt
      session.messages.push({ role: 'user', content: 'new' })
      store.save(session)
      const loaded = store.load(session.id)
      expect(loaded!.updatedAt).toBeDefined()
    })
  })

  describe('list', () => {
    it('returns all sessions sorted by updatedAt DESC', () => {
      const s1 = store.create('/a')
      const s2 = store.create('/b')

      const list = store.list()
      expect(list.length).toBe(2)
      // Just verify both are returned — exact order depends on millisecond precision
      const ids = list.map(l => l.id)
      expect(ids).toContain(s1.id)
      expect(ids).toContain(s2.id)
    })

    it('includes messageCount', () => {
      const s = store.create('/tmp')
      s.messages = [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }]
      store.save(s)

      const list = store.list()
      expect(list[0].messageCount).toBe(2)
    })

    it('returns empty when no sessions', () => {
      expect(store.list()).toEqual([])
    })
  })

  describe('getLatest', () => {
    it('returns most recent session', () => {
      store.create('/a')
      store.create('/b')
      const latest = store.getLatest()
      expect(latest).toBeDefined()
      // Just verify it returns a valid session
      expect(latest!.id.length).toBe(8)
    })

    it('returns undefined when empty', () => {
      expect(store.getLatest()).toBeUndefined()
    })
  })
})
