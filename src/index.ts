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
    else if (arg === '--model' || arg === '-m') { flags.model = args[++i] }
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
  -m, --model <model>           Model to use (sonnet, opus, haiku)
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

  // Read piped stdin
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer)
    }
    const stdinContent = Buffer.concat(chunks).toString('utf-8').trim()
    if (stdinContent) {
      const existingPrompt = (flags.prompt as string) || ''
      flags.prompt = existingPrompt
        ? `${existingPrompt}\n\n<stdin>\n${stdinContent}\n</stdin>`
        : stdinContent
    }
  }

  if (flags.prompt) {
    await runOneShot(flags.prompt as string, process.cwd(), flags.model as string | undefined)
    return
  }

  await startRepl({
    resume: flags.resume as string | undefined,
    workingDir: process.cwd(),
    model: flags.model as string | undefined,
  })
}

async function runOneShot(prompt: string, workingDir: string, modelFlag?: string): Promise<void> {
  const { loadConfig, getApiKey } = await import('./utils/config.js')
  const { ToolRegistry } = await import('./tools/registry.js')
  const { TokenCounter } = await import('./engine/tokenCounter.js')
  const { ContextManager } = await import('./engine/contextManager.js')
  const { QueryEngine } = await import('./engine/queryEngine.js')
  const { registerAllTools } = await import('./tools/registerAll.js')
  const { setGlobalEngine } = await import('./repl.js')
  const { buildGitContext } = await import('./git/gitContext.js')

  const config = loadConfig()
  const apiKey = getApiKey()

  const MODEL_MAP: Record<string, string> = {
    'sonnet': 'claude-sonnet-4-20250514',
    'opus': 'claude-opus-4-20250514',
    'haiku': 'claude-haiku-3-5-20241022',
  }
  const resolvedModel = modelFlag
    ? MODEL_MAP[modelFlag] || modelFlag
    : config.model

  const toolRegistry = new ToolRegistry()
  registerAllTools(toolRegistry)

  const tokenCounter = new TokenCounter(resolvedModel)
  const contextManager = new ContextManager()

  const gitContext = await buildGitContext(workingDir)

  const engine = new QueryEngine({
    apiKey,
    model: resolvedModel,
    toolRegistry,
    tokenCounter,
    contextManager,
    permissionConfig: {
      mode: config.permissionMode,
      rules: [],
      alwaysAllow: new Set(),
    },
    gitContext,
  })
  setGlobalEngine(engine)

  const messages = [{ role: 'user' as const, content: prompt }]

  try {
    await engine.run(messages, workingDir)
  } catch (err) {
    console.error(theme.error((err as Error).message))
    process.exit(1)
  }

  // Print cost summary
  console.log()
  console.log(theme.dim(tokenCounter.formatUsage()))
}

main().catch(err => {
  console.error(theme.error(err.message))
  process.exit(1)
})
