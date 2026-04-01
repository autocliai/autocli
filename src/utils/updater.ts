import { theme } from '../ui/theme.js'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { platform } from './platform.js'

const VERSION = '0.1.0'
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours

export async function checkForUpdate(): Promise<string | null> {
  const checkFile = join(platform.configDir, '.last-update-check')

  // Rate limit checks
  if (existsSync(checkFile)) {
    const lastCheck = parseInt(readFileSync(checkFile, 'utf-8').trim(), 10)
    if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL) return null
  }

  try {
    mkdirSync(platform.configDir, { recursive: true })
    writeFileSync(checkFile, String(Date.now()))

    const res = await fetch('https://registry.npmjs.org/mini-claude/latest', {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null

    const data = await res.json() as { version?: string }
    const latest = data.version
    if (!latest) return null

    if (latest !== VERSION) {
      return latest
    }
  } catch {
    // Silent failure — don't block startup for update check
  }

  return null
}

export function showUpdateNotice(latestVersion: string): void {
  console.log()
  console.log(theme.warning(`  Update available: ${VERSION} → ${latestVersion}`))
  console.log(theme.dim('  Run: bun update -g mini-claude'))
  console.log()
}
