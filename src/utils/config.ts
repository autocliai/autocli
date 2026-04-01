import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { platform } from './platform.js'

export interface AppConfig {
  apiKey?: string
  model: string
  maxTokens: number
  permissionMode: 'default' | 'auto-approve' | 'deny-all'
  hooks: Array<{ event: string; command: string; pattern?: string }>
  remotePort: number
  remoteSecret?: string
  maxSessionCost: number  // in dollars
}

const DEFAULT_CONFIG: AppConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 8192,
  permissionMode: 'default',
  hooks: [],
  remotePort: 3456,
  maxSessionCost: 5.00,
}

export function loadConfig(): AppConfig {
  const configPath = join(platform.configDir, 'config.json')
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG }
  const raw = readFileSync(configPath, 'utf-8')
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
}

export function saveConfig(config: AppConfig): void {
  mkdirSync(platform.configDir, { recursive: true })
  const configPath = join(platform.configDir, 'config.json')
  writeFileSync(configPath, JSON.stringify(config, null, 2))
}

export function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY || loadConfig().apiKey
  if (!key) {
    console.error('Set ANTHROPIC_API_KEY env var or run: mini-claude --set-key <key>')
    process.exit(1)
  }
  return key
}
