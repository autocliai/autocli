import { describe, expect, test, beforeEach, afterAll } from 'bun:test'
import { fileEditTool } from '../../src/tools/fileEdit.js'
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'

const TMP = '/tmp/mini-claude-test-edit'
const FILE = join(TMP, 'edit.txt')

beforeEach(() => {
  mkdirSync(TMP, { recursive: true })
  writeFileSync(FILE, 'function hello() {\n  return "hello"\n}\n')
})

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('fileEditTool', () => {
  test('replaces exact string match', async () => {
    const result = await fileEditTool.call(
      { file_path: FILE, old_string: 'return "hello"', new_string: 'return "world"' },
      { workingDir: TMP }
    )
    expect(result.isError).toBeFalsy()
    expect(readFileSync(FILE, 'utf-8')).toContain('return "world"')
  })

  test('fails if old_string not found', async () => {
    const result = await fileEditTool.call(
      { file_path: FILE, old_string: 'nonexistent', new_string: 'replacement' },
      { workingDir: TMP }
    )
    expect(result.isError).toBe(true)
  })

  test('fails if old_string has multiple matches without replace_all', async () => {
    writeFileSync(FILE, 'aaa\naaa\n')
    const result = await fileEditTool.call(
      { file_path: FILE, old_string: 'aaa', new_string: 'bbb' },
      { workingDir: TMP }
    )
    expect(result.isError).toBe(true)
  })

  test('replaces all with replace_all flag', async () => {
    writeFileSync(FILE, 'aaa\naaa\n')
    const result = await fileEditTool.call(
      { file_path: FILE, old_string: 'aaa', new_string: 'bbb', replace_all: true },
      { workingDir: TMP }
    )
    expect(result.isError).toBeFalsy()
    expect(readFileSync(FILE, 'utf-8')).toBe('bbb\nbbb\n')
  })
})
