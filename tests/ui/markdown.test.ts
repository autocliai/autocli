import { describe, expect, test } from 'bun:test'
import { renderMarkdown } from '../../src/ui/markdown.js'

describe('renderMarkdown', () => {
  test('renders bold text', () => {
    const result = renderMarkdown('**hello**')
    expect(result).toContain('hello')
    expect(result).not.toContain('**')
  })

  test('renders code blocks with language tag', () => {
    const result = renderMarkdown('```js\nconst x = 1\n```')
    expect(result).toContain('const x = 1')
    expect(result).not.toContain('```')
  })

  test('renders inline code', () => {
    const result = renderMarkdown('use `npm install`')
    expect(result).toContain('npm install')
    expect(result).not.toContain('`')
  })

  test('renders headers', () => {
    const result = renderMarkdown('# Title')
    expect(result).toContain('Title')
    expect(result).not.toContain('#')
  })

  test('renders bullet lists', () => {
    const result = renderMarkdown('- item one\n- item two')
    expect(result).toContain('item one')
    expect(result).toContain('item two')
  })
})
