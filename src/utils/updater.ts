import path from 'path'
import { platform } from './platform.js'
import { existsSync, statSync, mkdirSync, writeFileSync } from 'fs'

const CHECK_FILE = path.join(platform.configDir, '.last-update-check')
const ONE_DAY = 86400000

export async function checkForUpdate(): Promise<string | null> {
  try {
    if (existsSync(CHECK_FILE)) {
      const stat = statSync(CHECK_FILE)
      if (Date.now() - stat.mtimeMs < ONE_DAY) return null
    }
    const response = await fetch('https://registry.npmjs.org/autocli2/latest', { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return null
    const data = await response.json() as { version: string }
    mkdirSync(platform.configDir, { recursive: true })
    writeFileSync(CHECK_FILE, data.version)
    return data.version
  } catch { return null }
}

export function showUpdateNotice(latestVersion: string, currentVersion: string): string | null {
  // Only show notice when latest is actually newer (simple semver comparison)
  const parse = (v: string) => v.replace(/^v/, '').split(/[-+]/)[0].split('.').map(Number)
  const [la = 0, lb = 0, lc = 0] = parse(latestVersion)
  const [ca = 0, cb = 0, cc = 0] = parse(currentVersion)
  if (la < ca || (la === ca && lb < cb) || (la === ca && lb === cb && lc <= cc)) return null
  return `Update available: ${currentVersion} → ${latestVersion}. Run: bun update -g autocli2`
}
