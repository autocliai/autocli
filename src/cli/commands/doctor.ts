import type { CommandDefinition } from './types.js'
import { theme } from '../ui/theme.js'
import { existsSync } from 'fs'
import { platform } from '../../utils/platform.js'
import { join } from 'path'
import { formatError, formatWarning, formatSuccess } from '../ui/errorFormat.js'
import { isLicenseActive } from './activate.js'

export const doctorCommand: CommandDefinition = {
  name: 'doctor',
  description: 'Diagnose environment issues',

  async execute(_args, context) {
    const checks: Array<{ label: string; status: 'ok' | 'warn' | 'error'; detail: string }> = []

    // Check API key
    const hasKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY
    checks.push({ label: 'API Key', status: hasKey ? 'ok' : 'error', detail: hasKey ? 'API key set' : 'No API key set (OPENAI_API_KEY or ANTHROPIC_API_KEY)' })

    // Check git
    try {
      const gitProc = Bun.spawnSync(['git', '--version'], { stdout: 'pipe' })
      const gitVersion = new TextDecoder().decode(gitProc.stdout).trim()
      checks.push({ label: 'Git', status: gitProc.exitCode === 0 ? 'ok' : 'warn', detail: gitVersion || 'Not found' })
    } catch {
      checks.push({ label: 'Git', status: 'warn', detail: 'Not found' })
    }

    // Check ripgrep
    try {
      const rgProc = Bun.spawnSync(['rg', '--version'], { stdout: 'pipe' })
      const rgVersion = new TextDecoder().decode(rgProc.stdout).trim().split('\n')[0]
      checks.push({ label: 'Ripgrep', status: rgProc.exitCode === 0 ? 'ok' : 'warn', detail: rgVersion || 'Not found (grep fallback)' })
    } catch {
      checks.push({ label: 'Ripgrep', status: 'warn', detail: 'Not found (grep fallback)' })
    }

    // Check Bun version
    checks.push({ label: 'Bun', status: 'ok', detail: `v${Bun.version}` })

    // Check config dir
    checks.push({ label: 'Config', status: existsSync(platform.configDir) ? 'ok' : 'warn', detail: platform.configDir })

    // Check CLAUDE.md
    const hasClaude = existsSync(join(context.workingDir, 'CLAUDE.md'))
    checks.push({ label: 'CLAUDE.md', status: hasClaude ? 'ok' : 'warn', detail: hasClaude ? 'Found' : 'Not found (run /init)' })

    // Check git repo
    try {
      const isRepo = Bun.spawnSync(['git', 'rev-parse', '--is-inside-work-tree'], { cwd: context.workingDir, stdout: 'pipe' })
      checks.push({ label: 'Git repo', status: isRepo.exitCode === 0 ? 'ok' : 'warn', detail: isRepo.exitCode === 0 ? 'Yes' : 'Not a git repo' })
    } catch {
      checks.push({ label: 'Git repo', status: 'warn', detail: 'Not a git repo' })
    }

    // Platform
    checks.push({ label: 'Platform', status: 'ok', detail: `${process.platform} ${process.arch}` })

    // Shell
    checks.push({ label: 'Shell', status: 'ok', detail: platform.shell })

    // Terminal
    checks.push({ label: 'Terminal', status: 'ok', detail: `${platform.columns}×${platform.rows}` })

    // License
    const licensed = await isLicenseActive()
    checks.push({ label: 'License', status: licensed ? 'ok' : 'warn', detail: licensed ? 'Active' : 'Not activated (run /activate <key>)' })

    const lines = [theme.bold('Environment Diagnostics:'), '']
    for (const c of checks) {
      const line = c.status === 'ok' ? formatSuccess(`${c.label.padEnd(12)} ${c.detail}`)
        : c.status === 'warn' ? formatWarning(`${c.label.padEnd(12)} ${c.detail}`)
        : formatError(`${c.label.padEnd(12)} ${c.detail}`)
      lines.push(`  ${line}`)
    }

    return { output: lines.join('\n') }
  },
}
