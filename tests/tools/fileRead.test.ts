import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { fileReadTool } from '../../src/tools/fileRead.js'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'

const TMP = '/tmp/mini-claude-test-read'

beforeAll(() => {
  mkdirSync(TMP, { recursive: true })
  writeFileSync(join(TMP, 'test.txt'), 'line1\nline2\nline3\nline4\nline5')
})

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('fileReadTool', () => {
  test('reads entire file', async () => {
    const result = await fileReadTool.call(
      { file_path: join(TMP, 'test.txt') },
      { workingDir: TMP }
    )
    expect(result.output).toContain('line1')
    expect(result.output).toContain('line5')
  })

  test('reads with offset and limit', async () => {
    const result = await fileReadTool.call(
      { file_path: join(TMP, 'test.txt'), offset: 2, limit: 2 },
      { workingDir: TMP }
    )
    expect(result.output).toContain('line2')
    expect(result.output).toContain('line3')
    expect(result.output).not.toContain('line1')
  })

  test('returns error for missing file', async () => {
    const result = await fileReadTool.call(
      { file_path: join(TMP, 'missing.txt') },
      { workingDir: TMP }
    )
    expect(result.isError).toBe(true)
  })
})
