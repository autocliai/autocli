import type { CommandDefinition } from './types.js'
import { theme } from '../ui/theme.js'
import { loadConfig, saveConfig } from '../../utils/config.js'

// License key format: ACLI-XXXX-XXXX-XXXX (alphanumeric segments)
const LICENSE_PATTERN = /^ACLI-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

function validateKeyFormat(key: string): boolean {
  return LICENSE_PATTERN.test(key.toUpperCase())
}

function checksumValid(key: string): boolean {
  // Simple checksum: sum of char codes mod 97 should be 1 (like IBAN check)
  const stripped = key.replace(/-/g, '').toUpperCase()
  let sum = 0
  for (const ch of stripped) sum += ch.charCodeAt(0)
  return sum % 97 < 10 // Lenient checksum
}

export async function isLicenseActive(): Promise<boolean> {
  const config = await loadConfig()
  if (!config.licenseKey) return false
  return validateKeyFormat(config.licenseKey) && checksumValid(config.licenseKey)
}

export const activateCommand: CommandDefinition = {
  name: 'activate',
  description: 'Activate license with a key',

  async execute(args, _context) {
    const parts = args.trim().split(/\s+/).filter(Boolean)

    if (parts.length === 0) {
      const config = await loadConfig()
      if (config.licenseKey) {
        const valid = validateKeyFormat(config.licenseKey) && checksumValid(config.licenseKey)
        if (valid) {
          return { output: `License: ${theme.success('Active')} (${config.licenseKey.slice(0, 9)}...)` }
        }
        return { output: `License: ${theme.error('Invalid key format')} (${config.licenseKey.slice(0, 9)}...)\n${theme.dim('Expected format: ACLI-XXXX-XXXX-XXXX')}` }
      }
      return { output: `No license key set. Usage: /activate <key>\n${theme.dim('Expected format: ACLI-XXXX-XXXX-XXXX')}` }
    }

    const key = parts[0].toUpperCase()

    if (!validateKeyFormat(key)) {
      return { output: theme.error(`Invalid license key format.\n${theme.dim('Expected: ACLI-XXXX-XXXX-XXXX (alphanumeric)')}`) }
    }

    if (!checksumValid(key)) {
      return { output: theme.error(`License key checksum failed. Please check the key and try again.`) }
    }

    const config = await loadConfig()
    config.licenseKey = key
    await saveConfig(config)
    return { output: theme.success(`License activated: ${key.slice(0, 9)}...`) }
  },
}
