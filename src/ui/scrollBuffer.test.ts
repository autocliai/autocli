import { describe, it, expect } from 'bun:test'
import { ScrollBuffer } from './scrollBuffer.js'

describe('ScrollBuffer', () => {
  it('appends text and splits on newlines', () => {
    const buf = new ScrollBuffer(5)
    buf.append('line1\nline2\nline3')
    expect(buf.totalLines).toBe(3)
  })

  it('auto-scrolls to bottom on append', () => {
    const buf = new ScrollBuffer(2)
    buf.append('a\nb\nc\nd\ne')
    expect(buf.isAtBottom).toBe(true)
    expect(buf.getVisible()).toEqual(['d', 'e'])
  })

  it('scrollUp reduces offset', () => {
    const buf = new ScrollBuffer(2)
    buf.append('a\nb\nc\nd')
    buf.scrollUp(1)
    expect(buf.getVisible()).toEqual(['b', 'c'])
  })

  it('scrollUp clamps to 0', () => {
    const buf = new ScrollBuffer(2)
    buf.append('a\nb\nc')
    buf.scrollUp(100)
    expect(buf.getVisible()[0]).toBe('a')
  })

  it('scrollDown increases offset', () => {
    const buf = new ScrollBuffer(2)
    buf.append('a\nb\nc\nd')
    buf.scrollToTop()
    buf.scrollDown(1)
    expect(buf.getVisible()).toEqual(['b', 'c'])
  })

  it('scrollDown clamps to max', () => {
    const buf = new ScrollBuffer(2)
    buf.append('a\nb\nc\nd')
    buf.scrollToTop()
    buf.scrollDown(100)
    expect(buf.isAtBottom).toBe(true)
  })

  it('scrollToTop goes to offset 0', () => {
    const buf = new ScrollBuffer(2)
    buf.append('a\nb\nc\nd')
    buf.scrollToTop()
    expect(buf.getVisible()[0]).toBe('a')
  })

  it('scrollToBottom goes to end', () => {
    const buf = new ScrollBuffer(2)
    buf.append('a\nb\nc\nd')
    buf.scrollToTop()
    buf.scrollToBottom()
    expect(buf.isAtBottom).toBe(true)
  })

  it('isAtBottom is false after scrollUp', () => {
    const buf = new ScrollBuffer(2)
    buf.append('a\nb\nc\nd')
    buf.scrollUp(1)
    expect(buf.isAtBottom).toBe(false)
  })

  it('clear resets everything', () => {
    const buf = new ScrollBuffer(5)
    buf.append('a\nb\nc')
    buf.clear()
    expect(buf.totalLines).toBe(0)
    expect(buf.getVisible()).toEqual([])
  })

  it('getScrollIndicator is empty when content fits', () => {
    const buf = new ScrollBuffer(10)
    buf.append('a\nb')
    expect(buf.getScrollIndicator()).toBe('')
  })

  it('getScrollIndicator shows percentage when scrollable', () => {
    const buf = new ScrollBuffer(2)
    buf.append('a\nb\nc\nd\ne')
    buf.scrollToTop()
    expect(buf.getScrollIndicator()).toContain('0%')
    buf.scrollToBottom()
    expect(buf.getScrollIndicator()).toContain('100%')
  })
})
