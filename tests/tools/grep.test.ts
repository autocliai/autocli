import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { grepTool } from '../../src/tools/grep.js'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'

const TMP = '/tmp/mini-claude-test-grep'

beforeAll(() => {
  mkdirSync(TMP, { recursive: true })
  writeFileSync(join(TMP, 'app.ts'), 'const API_KEY = "secret"\nconst name = "test"\n')
  writeFileSync(join(TMP, 'utils.ts'), 'export function helper() {}\n')
})

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('grepTool', () => {
  test('finds matching content', async () => {
    const result = await grepTool.call(
      { pattern: 'API_KEY', path: TMP },
      { workingDir: TMP }
    )
    expect(result.output).toContain('API_KEY')
    expect(result.output).toContain('app.ts')
  })

  test('returns empty for no matches', async () => {
    const result = await grepTool.call(
      { pattern: 'NONEXISTENT', path: TMP },
      { workingDir: TMP }
    )
    expect(result.output).toContain('No matches')
  })
})
