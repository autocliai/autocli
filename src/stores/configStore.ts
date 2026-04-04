import { loadConfig, saveConfig, type AppConfig } from '../utils/config.js'

export class ConfigStore {
  private config: AppConfig | null = null

  async load(): Promise<AppConfig> {
    if (!this.config) this.config = await loadConfig()
    return this.config
  }

  async save(config: AppConfig): Promise<void> {
    this.config = config
    await saveConfig(config)
  }

  async update(partial: Partial<AppConfig>): Promise<AppConfig> {
    const current = await this.load()
    const updated = { ...current, ...partial }
    await this.save(updated)
    return updated
  }

  get cached(): AppConfig | null { return this.config }
}
