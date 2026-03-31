#!/usr/bin/env bun

import { startRepl } from './repl.js'
import { startHeadless } from './remote/headless.js'
import { theme } from './ui/theme.js'

const args = process.argv.slice(2)

function parseArgs() {
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') { flags.help = true }
    else if (arg === '--version' || arg === '-v') { flags.version = true }
    else if (arg === '--resume' || arg === '-r') { flags.resume = args[++i] || 'latest' }
    else if (arg === '--headless') { flags.headless = true }
    else if (arg === '--port' || arg === '-p') { flags.port = args[++i] }
    else if (arg === '--prompt') { flags.prompt = args[++i] }
    else if (arg === '--set-key') { flags.setKey = args[++i] }
    else if (!arg.startsWith('-')) { flags.prompt = arg }
  }
  return flags
}

async function main() {
  const flags = parseArgs()

  if (flags.version) {
    console.log('mini-claude v0.1.0')
    process.exit(0)
  }

  if (flags.help) {
    console.log(`
${theme.bold('mini-claude')} — A minimal AI coding assistant

${theme.bold('Usage:')}
  mini-claude                    Start interactive REPL
  mini-claude "prompt"           One-shot query
  mini-claude --resume [id]      Resume a session
  mini-claude --headless         Start as remote daemon

${theme.bold('Options:')}
  -h, --help                    Show this help
  -v, --version                 Show version
  -r, --resume [id]             Resume session (latest if no id)
  -p, --port <port>             Port for headless mode (default: 3456)
  --headless                    Run as headless daemon
  --set-key <key>               Save API key
`)
    process.exit(0)
  }

  if (flags.setKey) {
    const { saveConfig, loadConfig } = await import('./utils/config.js')
    const config = loadConfig()
    config.apiKey = flags.setKey as string
    saveConfig(config)
    console.log(theme.success('API key saved.'))
    process.exit(0)
  }

  if (flags.headless) {
    const port = Number(flags.port) || 3456
    await startHeadless(port)
    return
  }

  await startRepl({
    resume: flags.resume as string | undefined,
    workingDir: process.cwd(),
  })
}

main().catch(err => {
  console.error(theme.error(err.message))
  process.exit(1)
})
