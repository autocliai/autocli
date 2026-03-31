import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { globTool } from '../../src/tools/glob.js'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'

const TMP = '/tmp/mini-claude-test-glob'

beforeAll(() => {
  mkdirSync(join(TMP, 'src'), { recursive: true })
  mkdirSync(join(TMP, 'lib'), { recursive: true })
  writeFileSync(join(TMP, 'src', 'app.ts'), 'export {}')
  writeFileSync(join(TMP, 'src', 'utils.ts'), 'export {}')
  writeFileSync(join(TMP, 'lib', 'helper.js'), 'module.exports = {}')
  writeFileSync(join(TMP, 'README.md'), '# test')
})

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('globTool', () => {
  test('finds files matching pattern', async () => {
    const result = await globTool.call(
      { pattern: '**/*.ts', path: TMP },
      { workingDir: TMP }
    )
    expect(result.output).toContain('app.ts')
    expect(result.output).toContain('utils.ts')
    expect(result.output).not.toContain('helper.js')
  })

  test('finds all files with wildcard', async () => {
    const result = await globTool.call(
      { pattern: '**/*', path: TMP },
      { workingDir: TMP }
    )
    expect(result.output).toContain('README.md')
  })
})
