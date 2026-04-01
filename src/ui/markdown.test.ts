import { describe, it, expect } from 'bun:test'
import { renderMarkdown } from './markdown.js'

describe('renderMarkdown', () => {
  it('renders h1 headers', () => {
    const result = renderMarkdown('# Hello')
    expect(result).toContain('Hello')
  })

  it('renders h2 headers', () => {
    const result = renderMarkdown('## Section')
    expect(result).toContain('Section')
  })

  it('renders h3 headers', () => {
    const result = renderMarkdown('### Sub')
    expect(result).toContain('Sub')
  })

  it('renders code blocks', () => {
    const result = renderMarkdown('```js\nconsole.log("hi")\n```')
    expect(result).toContain('console')
    expect(result).toContain('log')
  })

  it('renders bullet lists', () => {
    const result = renderMarkdown('- item one\n- item two')
    expect(result).toContain('•')
    expect(result).toContain('item one')
  })

  it('renders tables', () => {
    const result = renderMarkdown('| Name | Age |\n|---|---|\n| Alice | 30 |')
    expect(result).toContain('Name')
    expect(result).toContain('Alice')
    expect(result).toContain('30')
  })

  it('handles empty string', () => {
    expect(renderMarkdown('')).toBe('')
  })

  it('passes plain text through', () => {
    const result = renderMarkdown('just plain text')
    expect(result).toContain('just plain text')
  })

  it('renders inline code', () => {
    const result = renderMarkdown('use `foo()` here')
    expect(result).toContain('foo()')
  })

  it('renders bold text', () => {
    const result = renderMarkdown('this is **bold** text')
    expect(result).toContain('bold')
  })

  it('renders italic text', () => {
    const result = renderMarkdown('this is *italic* text')
    expect(result).toContain('italic')
  })

  it('renders horizontal rule', () => {
    const result = renderMarkdown('---')
    expect(typeof result).toBe('string')
  })

  it('renders numbered lists', () => {
    const result = renderMarkdown('1. first\n2. second')
    expect(result).toContain('first')
    expect(result).toContain('second')
  })

  it('handles code block with language tag', () => {
    const result = renderMarkdown('```typescript\nconst x = 1\n```')
    expect(result).toContain('typescript')
  })
})
