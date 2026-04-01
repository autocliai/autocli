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
  provider: 'anthropic' | 'openai' | 'claude-local' | 'minimaxi-cn'
  openaiApiKey?: string
  openaiBaseUrl?: string
  claudeLocalCommand?: string       // path to claude CLI (default: 'claude')
  claudeLocalArgs?: string[]        // extra args for claude CLI
  claudeLocalModel?: string         // model override for claude CLI (e.g. 'sonnet')
  minimaxiApiKey?: string
  minimaxiBaseUrl?: string          // default: https://www.minimaxi.com/v1
  minimaxiModel?: string            // default: miniMax-2.7
  licenseKey?: string
}

const DEFAULT_CONFIG: AppConfig = {
  model: 'claude-opus-4-6-20250616',
  maxTokens: 8192,
  permissionMode: 'default',
  hooks: [],
  remotePort: 3456,
  maxSessionCost: 5.00,
  provider: 'anthropic',
}

export function loadConfig(): AppConfig {
  const configPath = join(platform.configDir, 'config.json')
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG }
  try {
    const raw = readFileSync(configPath, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config: AppConfig): void {
  mkdirSync(platform.configDir, { recursive: true })
  const configPath = join(platform.configDir, 'config.json')
  writeFileSync(configPath, JSON.stringify(config, null, 2))
}

export const MODEL_MAP: Record<string, string> = {
  'sonnet': 'claude-sonnet-4-20250514',
  'opus': 'claude-opus-4-6-20250616',
  'haiku': 'claude-haiku-4-5-20251001',
  'local': 'claude-local',
  'minimax': 'miniMax-2.7',
}

/** Human-friendly display name for a model ID */
export function modelDisplayName(model: string): string {
  if (model === 'claude-local') return 'claude (local)'
  if (model.startsWith('miniMax')) return model
  // Fallback: extract key parts from model ID like "claude-opus-4-6-20250616" → "opus 4.6"
  const m = model.replace('claude-', '')
  // Match patterns like "opus-4-6-date" → "opus 4.6" or "sonnet-4-date" → "sonnet 4"
  const match = m.match(/^(\w+)-(\d+)(?:-(\d+))?-\d{8}/)
  if (match) {
    const [, name, major, minor] = match
    return minor ? `${name} ${major}.${minor}` : `${name} ${major}`
  }
  return model
}

const VALID_PROVIDERS = new Set(['anthropic', 'openai', 'claude-local', 'minimaxi-cn'])

export function resolveProvider(name: string | undefined, fallback: AppConfig['provider']): AppConfig['provider'] {
  if (name && VALID_PROVIDERS.has(name)) return name as AppConfig['provider']
  return fallback
}

export function resolveModel(name: string, fallback: string): string {
  return MODEL_MAP[name] || name || fallback
}

export function getApiKey(): string {
  const config = loadConfig()
  // claude-local provider doesn't need an API key
  if (config.provider === 'claude-local') return ''
  const key = process.env.ANTHROPIC_API_KEY || config.apiKey
  if (!key) {
    // If openai or minimaxi-cn is configured, we might not need an Anthropic key
    if (config.provider === 'openai' && config.openaiApiKey) return ''
    if (config.provider === 'minimaxi-cn' && config.minimaxiApiKey) return ''
    console.error('Set ANTHROPIC_API_KEY env var or run: autocli --set-key <key>')
    process.exit(1)
  }
  return key
}
