import { theme } from './theme.js'

export function formatError(message: string): string {
  return `${theme.error('✗ Error:')} ${message}`
}

export function formatWarning(message: string): string {
  return `${theme.warning('⚠ Warning:')} ${message}`
}

export function formatInfo(message: string): string {
  return `${theme.info('ℹ Info:')} ${message}`
}

export function formatSuccess(message: string): string {
  return `${theme.success('✓')} ${message}`
}
