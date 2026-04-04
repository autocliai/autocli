import { z } from 'zod'
import path from 'path'
import { platform } from './platform.js'
import { logger } from './logger.js'

const HookSchema = z.object({
  event: z.enum(['before_tool_call', 'after_tool_call', 'on_error']),
  command: z.string(),
  pattern: z.string().optional(),
})

const ConfigSchema = z.object({
  model: z.string().default('claude-opus-4-6'),
  maxTokens: z.number().default(8192),
  permissionMode: z.enum(['default', 'auto-approve', 'deny-all', 'llm-confirm']).default('default'),
  provider: z.enum(['openai', 'claude-local', 'minimaxi-cn']).default('claude-local'),
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().default('https://api.openai.com/v1'),
  claudeLocalCommand: z.string().default('claude'),
  claudeLocalArgs: z.array(z.string()).default([]),
  claudeLocalModel: z.string().default('sonnet'),
  minimaxiApiKey: z.string().optional(),
  minimaxiBaseUrl: z.string().default('https://www.minimaxi.com/v1'),
  minimaxiModel: z.string().default('miniMax-2.7'),
  hooks: z.array(HookSchema).default([]),
  maxSessionCost: z.number().default(5.0),
  licenseKey: z.string().optional(),
})

export type AppConfig = z.infer<typeof ConfigSchema>
export type HookDefinition = z.infer<typeof HookSchema>

export const MODEL_MAP: Record<string, string> = {
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
  haiku: 'claude-haiku-4-5',
  minimax: 'miniMax-2.7',
}

const DISPLAY_NAMES: Record<string, string> = {
  'claude-opus-4-6': 'Opus 4.6',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-haiku-4-5': 'Haiku 4.5',
  'miniMax-2.7': 'MiniMax 2.7',
}

export function modelDisplayName(model: string): string {
  if (DISPLAY_NAMES[model]) return DISPLAY_NAMES[model]
  if (model.startsWith('claude-')) {
    const parts = model.replace('claude-', '').split('-')
    const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
    const version = parts.slice(1).join('.')
    return version ? `${name} ${version}` : name
  }
  return model
}

export function resolveModel(input: string): string {
  return MODEL_MAP[input] || input
}

export function resolveProvider(model: string, config: AppConfig): string {
  if (model.startsWith('miniMax')) return 'minimaxi-cn'
  return config.provider
}

export function getApiKey(provider: string, config: AppConfig): string | undefined {
  switch (provider) {
    case 'openai':
      return config.openaiApiKey || process.env.OPENAI_API_KEY
    case 'minimaxi-cn':
      return config.minimaxiApiKey || process.env.MINIMAXI_API_KEY
    default:
      return undefined
  }
}

const configPath = path.join(platform.configDir, 'config.json')

export async function loadConfig(): Promise<AppConfig> {
  try {
    const file = Bun.file(configPath)
    if (await file.exists()) {
      const raw = await file.json()
      return ConfigSchema.parse(raw)
    }
  } catch (e) {
    logger.warn('Failed to load config, using defaults', { error: String(e) })
  }
  return ConfigSchema.parse({})
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const { mkdirSync } = await import('fs')
  mkdirSync(path.dirname(configPath), { recursive: true })
  await Bun.write(configPath, JSON.stringify(config, null, 2))
}
