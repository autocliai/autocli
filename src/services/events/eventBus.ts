import type { EventType, EventData, EventHandler } from './types.js'
import { appendFileSync } from 'fs'
import { logger } from '../../utils/logger.js'

export class EventBus {
  private listeners = new Map<EventType, Set<EventHandler>>()
  private logPath: string | null = null

  on(event: EventType, handler: EventHandler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
  }

  off(event: EventType, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit(event: EventType, data: EventData): void {
    const handlers = this.listeners.get(event)
    if (handlers) for (const h of handlers) { try { h(data, event) } catch (e) { logger.error('EventBus handler error', { event, error: String(e) }) } }
    if (event !== '*') {
      const wildcards = this.listeners.get('*')
      if (wildcards) for (const h of wildcards) { try { h(data, event) } catch (e) { logger.error('EventBus handler error', { event, error: String(e) }) } }
    }
    if (this.logPath) {
      try { appendFileSync(this.logPath, JSON.stringify({ type: event, data, ts: Date.now() }) + '\n') } catch {}
    }
  }

  enableFileLog(path: string): void { this.logPath = path }
}
