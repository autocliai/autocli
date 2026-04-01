import { describe, expect, test } from 'bun:test'
import { createVimState, handleVimKey, getModeIndicator } from '../../src/ui/vim.js'
import type { VimState } from '../../src/ui/vim.js'

describe('vim mode', () => {
  test('createVimState returns insert mode by default', () => {
    const s = createVimState()
    expect(s.mode).toBe('insert')
    expect(s.buffer).toBe('')
    expect(s.cursor).toBe(0)
    expect(s.register).toBe('')
  })

  test('escape switches from insert to normal mode', () => {
    const s = createVimState()
    const { state, action } = handleVimKey(s, '\x1b')
    expect(state.mode).toBe('normal')
    expect(action).toBe('mode_change')
  })

  test('i switches from normal to insert mode', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 2, register: '' }
    const { state, action } = handleVimKey(s, 'i')
    expect(state.mode).toBe('insert')
    expect(state.cursor).toBe(2)
    expect(action).toBe('mode_change')
  })

  test('a switches to insert after cursor', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 2, register: '' }
    const { state, action } = handleVimKey(s, 'a')
    expect(state.mode).toBe('insert')
    expect(state.cursor).toBe(3)
    expect(action).toBe('mode_change')
  })

  test('I moves to start of line and enters insert', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 3, register: '' }
    const { state } = handleVimKey(s, 'I')
    expect(state.mode).toBe('insert')
    expect(state.cursor).toBe(0)
  })

  test('A moves to end of line and enters insert', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 1, register: '' }
    const { state } = handleVimKey(s, 'A')
    expect(state.mode).toBe('insert')
    expect(state.cursor).toBe(5)
  })

  test('h moves cursor left', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 3, register: '' }
    const { state, action } = handleVimKey(s, 'h')
    expect(state.cursor).toBe(2)
    expect(action).toBe('none')
  })

  test('h does not go below 0', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 0, register: '' }
    const { state } = handleVimKey(s, 'h')
    expect(state.cursor).toBe(0)
  })

  test('l moves cursor right', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 2, register: '' }
    const { state } = handleVimKey(s, 'l')
    expect(state.cursor).toBe(3)
  })

  test('0 moves to start of line', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 4, register: '' }
    const { state } = handleVimKey(s, '0')
    expect(state.cursor).toBe(0)
  })

  test('$ moves to end of line', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 0, register: '' }
    const { state } = handleVimKey(s, '$')
    expect(state.cursor).toBe(4)
  })

  test('x deletes char under cursor', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 2, register: '' }
    const { state } = handleVimKey(s, 'x')
    expect(state.buffer).toBe('helo')
    expect(state.register).toBe('l')
  })

  test('D deletes to end of line', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 2, register: '' }
    const { state } = handleVimKey(s, 'D')
    expect(state.buffer).toBe('he')
    expect(state.register).toBe('llo')
  })

  test('dd deletes entire line', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 2, register: '' }
    const { state } = handleVimKey(s, 'dd')
    expect(state.buffer).toBe('')
    expect(state.register).toBe('hello')
    expect(state.cursor).toBe(0)
  })

  test('p pastes register after cursor', () => {
    const s: VimState = { mode: 'normal', buffer: 'helo', cursor: 1, register: 'l' }
    const { state } = handleVimKey(s, 'p')
    expect(state.buffer).toBe('hello')
  })

  test('enter submits in normal mode', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello', cursor: 0, register: '' }
    const { state, action } = handleVimKey(s, '\r')
    expect(action).toBe('submit')
    expect(state.mode).toBe('insert')
  })

  test('w moves to next word', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello world', cursor: 0, register: '' }
    const { state } = handleVimKey(s, 'w')
    expect(state.cursor).toBe(6)
  })

  test('b moves to previous word', () => {
    const s: VimState = { mode: 'normal', buffer: 'hello world', cursor: 8, register: '' }
    const { state } = handleVimKey(s, 'b')
    expect(state.cursor).toBe(5)
  })

  test('insert mode passes through non-escape keys', () => {
    const s = createVimState()
    const { action } = handleVimKey(s, 'a')
    expect(action).toBe('none')
  })

  test('getModeIndicator shows correct labels', () => {
    expect(getModeIndicator('normal')).toBe('-- NORMAL --')
    expect(getModeIndicator('insert')).toBe('-- INSERT --')
  })
})
