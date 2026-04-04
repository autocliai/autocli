import { initDatabase, closeDb } from '../../src/stores/db.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtempSync, mkdirSync, rmSync } from 'fs'
import type { CommandContext } from '../../src/cli/commands/types.js'

let tmpDir: string

export function setupTestDb(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'autocli-test-'))
  const dbPath = join(tmpDir, 'test.db')
  initDatabase(dbPath)
}

export function teardownTestDb(): void {
  closeDb()
  try { rmSync(tmpDir, { recursive: true }) } catch {}
}

export function getTmpDir(): string { return tmpDir }

export function makeContext(overrides?: Partial<CommandContext>): CommandContext {
  return {
    workingDir: tmpDir,
    sessionId: 'test-session',
    messages: [],
    model: 'claude-sonnet-4-6',
    totalTokens: { input: 0, output: 0 },
    totalCost: 0,
    ...overrides,
  }
}
