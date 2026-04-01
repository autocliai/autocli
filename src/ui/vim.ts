export type VimMode = 'insert' | 'normal'

export interface VimState {
  mode: VimMode
  buffer: string
  cursor: number
  register: string
}

export function createVimState(): VimState {
  return { mode: 'insert', buffer: '', cursor: 0, register: '' }
}

// Returns: { state, action } where action tells the caller what to do
export function handleVimKey(state: VimState, key: string): { state: VimState; action: 'none' | 'submit' | 'cancel' | 'mode_change' } {
  const s = { ...state }

  if (s.mode === 'insert') {
    if (key === '\x1b') { // Escape
      s.mode = 'normal'
      s.cursor = Math.max(0, s.cursor - 1)
      return { state: s, action: 'mode_change' }
    }
    // In insert mode, let readline handle all keys normally
    return { state: s, action: 'none' }
  }

  // NORMAL mode
  switch (key) {
    case 'i': // Enter insert at cursor
      s.mode = 'insert'
      return { state: s, action: 'mode_change' }
    case 'a': // Enter insert after cursor
      s.mode = 'insert'
      s.cursor = Math.min(s.buffer.length, s.cursor + 1)
      return { state: s, action: 'mode_change' }
    case 'I': // Insert at start of line
      s.mode = 'insert'
      s.cursor = 0
      return { state: s, action: 'mode_change' }
    case 'A': // Append at end of line
      s.mode = 'insert'
      s.cursor = s.buffer.length
      return { state: s, action: 'mode_change' }
    case 'h': // Move left
      s.cursor = Math.max(0, s.cursor - 1)
      return { state: s, action: 'none' }
    case 'l': // Move right
      s.cursor = Math.min(Math.max(0, s.buffer.length - 1), s.cursor + 1)
      return { state: s, action: 'none' }
    case '0': // Start of line
      s.cursor = 0
      return { state: s, action: 'none' }
    case '$': // End of line
      s.cursor = Math.max(0, s.buffer.length - 1)
      return { state: s, action: 'none' }
    case 'w': // Next word
      {
        const rest = s.buffer.slice(s.cursor)
        const match = rest.match(/^\S*\s+/)
        s.cursor = match ? Math.min(Math.max(0, s.buffer.length - 1), s.cursor + match[0].length) : Math.max(0, s.buffer.length - 1)
      }
      return { state: s, action: 'none' }
    case 'b': // Previous word
      {
        const before = s.buffer.slice(0, s.cursor)
        const match = before.match(/\s+\S*$/)
        s.cursor = match ? s.cursor - match[0].length : 0
      }
      return { state: s, action: 'none' }
    case 'x': // Delete char under cursor
      if (s.buffer.length > 0) {
        s.register = s.buffer[s.cursor] || ''
        s.buffer = s.buffer.slice(0, s.cursor) + s.buffer.slice(s.cursor + 1)
        s.cursor = Math.min(s.cursor, Math.max(0, s.buffer.length - 1))
      }
      return { state: s, action: 'none' }
    case 'D': // Delete to end of line
      s.register = s.buffer.slice(s.cursor)
      s.buffer = s.buffer.slice(0, s.cursor)
      s.cursor = Math.max(0, s.buffer.length - 1)
      return { state: s, action: 'none' }
    case 'dd': // Delete entire line (handled as 'd' then 'd')
      s.register = s.buffer
      s.buffer = ''
      s.cursor = 0
      return { state: s, action: 'none' }
    case 'p': // Paste after cursor
      if (s.register) {
        s.buffer = s.buffer.slice(0, s.cursor + 1) + s.register + s.buffer.slice(s.cursor + 1)
        s.cursor += s.register.length
      }
      return { state: s, action: 'none' }
    case 'u': // Undo — can't easily implement without history, just clear
      return { state: s, action: 'none' }
    case '\r': case '\n': // Enter submits in normal mode
      s.mode = 'insert'
      return { state: s, action: 'submit' }
    default:
      return { state: s, action: 'none' }
  }
}

export function getModeIndicator(mode: VimMode): string {
  return mode === 'normal' ? '-- NORMAL --' : '-- INSERT --'
}
