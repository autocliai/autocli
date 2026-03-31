import { describe, expect, test, afterAll } from 'bun:test'
import { SessionStore } from '../../src/session/sessionStore.js'
import { rmSync } from 'fs'

const TMP = '/tmp/mini-claude-test-sessions'

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('SessionStore', () => {
  test('creates and retrieves a session', () => {
    const store = new SessionStore(TMP)
    const session = store.create('/tmp')
    expect(session.id).toBeDefined()
    expect(session.messages).toEqual([])

    const loaded = store.load(session.id)
    expect(loaded).toBeDefined()
    expect(loaded!.id).toBe(session.id)
  })

  test('saves messages to session', () => {
    const store = new SessionStore(TMP)
    const session = store.create('/tmp')
    session.messages.push({ role: 'user', content: 'hello' })
    store.save(session)

    const loaded = store.load(session.id)
    expect(loaded!.messages).toHaveLength(1)
  })

  test('lists all sessions', () => {
    const store = new SessionStore(TMP)
    store.create('/tmp')
    store.create('/tmp')
    const list = store.list()
    expect(list.length).toBeGreaterThanOrEqual(2)
  })

  test('returns undefined for missing session', () => {
    const store = new SessionStore(TMP)
    expect(store.load('nonexistent')).toBeUndefined()
  })
})
