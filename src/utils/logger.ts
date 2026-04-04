type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
}

let currentLevel: LogLevel = (process.env.AUTOCLI_LOG_LEVEL as LogLevel) || 'warn'

export function setLogLevel(level: LogLevel) {
  currentLevel = level
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return
  const ts = new Date().toISOString()
  const ctx = context ? ' ' + JSON.stringify(context) : ''
  process.stderr.write(`${ts} [${level.toUpperCase()}] ${message}${ctx}\n`)
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
}
