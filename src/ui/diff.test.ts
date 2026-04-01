import { describe, it, expect } from 'bun:test'
import { formatDiff, formatEditDiff } from './diff.js'

describe('formatDiff', () => {
  it('returns a string', () => {
    expect(typeof formatDiff('+ added')).toBe('string')
  })

  it('processes all line types', () => {
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 unchanged
-removed line
+added line`
    const result = formatDiff(diff)
    expect(result).toContain('file.ts')
    expect(result).toContain('unchanged')
  })

  it('handles empty string', () => {
    expect(formatDiff('')).toBe('')
  })
})

describe('formatEditDiff', () => {
  it('contains file path', () => {
    const result = formatEditDiff('src/index.ts', 'old', 'new')
    expect(result).toContain('src/index.ts')
  })

  it('contains old and new content', () => {
    const result = formatEditDiff('file.ts', 'old line', 'new line')
    expect(result).toContain('old line')
    expect(result).toContain('new line')
  })

  it('handles multiline content', () => {
    const result = formatEditDiff('f.ts', 'line1\nline2', 'line3\nline4')
    expect(result).toContain('line1')
    expect(result).toContain('line4')
  })
})
