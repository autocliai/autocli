import { describe, it, expect } from 'bun:test'
import { Wire } from './wire.js'

describe('Wire', () => {
  it('emits events to specific listeners', () => {
    const wire = new Wire()
    let received: any = null
    wire.on('text', (event) => { received = event })
    wire.emit('text', 'hello')
    expect(received).not.toBeNull()
    expect(received.type).toBe('text')
    expect(received.data).toBe('hello')
    expect(typeof received.timestamp).toBe('number')
  })

  it('wildcard listener receives all events', () => {
    const wire = new Wire()
    const events: any[] = []
    wire.on('*', (event) => events.push(event))
    wire.emit('text', 'a')
    wire.emit('error', 'b')
    expect(events.length).toBe(2)
    expect(events[0].type).toBe('text')
    expect(events[1].type).toBe('error')
  })

  it('does not call unrelated listeners', () => {
    const wire = new Wire()
    let called = false
    wire.on('text', () => { called = true })
    wire.emit('error', 'oops')
    expect(called).toBe(false)
  })

  it('removes listener with off', () => {
    const wire = new Wire()
    let count = 0
    const listener = () => { count++ }
    wire.on('text', listener)
    wire.emit('text', 'a')
    expect(count).toBe(1)
    wire.off('text', listener)
    wire.emit('text', 'b')
    expect(count).toBe(1)
  })

  it('supports multiple listeners on same event', () => {
    const wire = new Wire()
    let a = 0, b = 0
    wire.on('text', () => { a++ })
    wire.on('text', () => { b++ })
    wire.emit('text', 'data')
    expect(a).toBe(1)
    expect(b).toBe(1)
  })

  it('timestamp is close to Date.now()', () => {
    const wire = new Wire()
    let ts = 0
    wire.on('text', (e) => { ts = e.timestamp })
    const before = Date.now()
    wire.emit('text', null)
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(Date.now())
  })
})
