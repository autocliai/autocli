import type { CommandDefinition, CommandResult } from './types.js'
import { loadConfig } from '../utils/config.js'

const DEFAULT_RC_SERVER = 'https://router.eclaw.ai'

export const rcCommand: CommandDefinition = {
  name: 'rc',
  description: 'Start a remote control session (browser-based). Usage: /rc [server-url]',
  aliases: ['remote'],

  async run(args): Promise<string | CommandResult> {
    const config = loadConfig()
    const serverUrl = args[0] || process.env.RC_SERVER_URL || DEFAULT_RC_SERVER

    // Need an API key for eclaw-router auth
    const apiKey = process.env.ECLAW_API_KEY || config.apiKey
    if (!apiKey) {
      return 'Set ECLAW_API_KEY env var or configure apiKey in config to use remote control.'
    }

    return { type: 'rc_start', serverUrl }
  },
}
