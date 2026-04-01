import { describe, expect, test } from 'bun:test'
import { ScrollBuffer } from '../../src/ui/scrollBuffer.js'

describe('ScrollBuffer', () => {
  test('starts empty', () => {
    const sb = new ScrollBuffer(10)
    expect(sb.totalLines).toBe(0)
    expect(sb.getVisible()).toEqual([])
  })

  test('appends lines', () => {
    const sb = new ScrollBuffer(10)
    sb.append('hello\nworld')
    expect(sb.totalLines).toBe(2)
  })

  test('getVisible returns viewport slice', () => {
    const sb = new ScrollBuffer(3)
    sb.append('a\nb\nc\nd\ne')
    const visible = sb.getVisible()
    expect(visible.length).toBe(3)
    expect(visible).toEqual(['c', 'd', 'e']) // auto-scrolled to bottom
  })

  test('scrollUp and scrollDown work', () => {
    const sb = new ScrollBuffer(3)
    sb.append('a\nb\nc\nd\ne')
    sb.scrollUp(1)
    expect(sb.getVisible()).toEqual(['b', 'c', 'd'])
    sb.scrollDown(1)
    expect(sb.getVisible()).toEqual(['c', 'd', 'e'])
  })

  test('scrollToTop and scrollToBottom', () => {
    const sb = new ScrollBuffer(3)
    sb.append('a\nb\nc\nd\ne')
    sb.scrollToTop()
    expect(sb.getVisible()).toEqual(['a', 'b', 'c'])
    sb.scrollToBottom()
    expect(sb.getVisible()).toEqual(['c', 'd', 'e'])
  })

  test('isAtBottom is true when scrolled to bottom', () => {
    const sb = new ScrollBuffer(3)
    sb.append('a\nb\nc\nd\ne')
    expect(sb.isAtBottom).toBe(true)
    sb.scrollUp(1)
    expect(sb.isAtBottom).toBe(false)
  })

  test('clear resets everything', () => {
    const sb = new ScrollBuffer(3)
    sb.append('a\nb\nc')
    sb.clear()
    expect(sb.totalLines).toBe(0)
    expect(sb.getVisible()).toEqual([])
  })

  test('getScrollIndicator returns empty when content fits', () => {
    const sb = new ScrollBuffer(10)
    sb.append('a\nb')
    expect(sb.getScrollIndicator()).toBe('')
  })

  test('getScrollIndicator returns percentage when scrolled', () => {
    const sb = new ScrollBuffer(3)
    sb.append('a\nb\nc\nd\ne')
    sb.scrollToTop()
    expect(sb.getScrollIndicator()).toContain('0%')
    sb.scrollToBottom()
    expect(sb.getScrollIndicator()).toContain('100%')
  })
})
