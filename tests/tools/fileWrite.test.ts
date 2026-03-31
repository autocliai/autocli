import { describe, expect, test, afterAll } from 'bun:test'
import { fileWriteTool } from '../../src/tools/fileWrite.js'
import { readFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

const TMP = '/tmp/mini-claude-test-write'

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('fileWriteTool', () => {
  test('creates a new file', async () => {
    const path = join(TMP, 'new.txt')
    const result = await fileWriteTool.call(
      { file_path: path, content: 'hello world' },
      { workingDir: TMP }
    )
    expect(result.isError).toBeFalsy()
    expect(readFileSync(path, 'utf-8')).toBe('hello world')
  })

  test('overwrites existing file', async () => {
    const path = join(TMP, 'new.txt')
    await fileWriteTool.call(
      { file_path: path, content: 'updated' },
      { workingDir: TMP }
    )
    expect(readFileSync(path, 'utf-8')).toBe('updated')
  })

  test('creates parent directories', async () => {
    const path = join(TMP, 'deep', 'nested', 'file.txt')
    await fileWriteTool.call(
      { file_path: path, content: 'nested' },
      { workingDir: TMP }
    )
    expect(existsSync(path)).toBe(true)
  })
})
