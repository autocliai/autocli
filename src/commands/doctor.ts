import type { CommandDefinition } from './types.js'
import { theme } from '../ui/theme.js'
import { existsSync } from 'fs'
import { platform } from '../utils/platform.js'
import { join } from 'path'

export const doctorCommand: CommandDefinition = {
  name: 'doctor',
  description: 'Diagnose environment issues',

  async run(_args, context) {
    const checks: Array<{ label: string; status: 'ok' | 'warn' | 'error'; detail: string }> = []

    // Check API key
    const hasKey = !!process.env.ANTHROPIC_API_KEY
    checks.push({ label: 'API Key', status: hasKey ? 'ok' : 'error', detail: hasKey ? 'ANTHROPIC_API_KEY set' : 'ANTHROPIC_API_KEY not set' })

    // Check git
    const gitProc = Bun.spawnSync(['git', '--version'], { stdout: 'pipe' })
    const gitVersion = new TextDecoder().decode(gitProc.stdout).trim()
    checks.push({ label: 'Git', status: gitProc.exitCode === 0 ? 'ok' : 'warn', detail: gitVersion || 'Not found' })

    // Check ripgrep
    const rgProc = Bun.spawnSync(['rg', '--version'], { stdout: 'pipe' })
    const rgVersion = new TextDecoder().decode(rgProc.stdout).trim().split('\n')[0]
    checks.push({ label: 'Ripgrep', status: rgProc.exitCode === 0 ? 'ok' : 'warn', detail: rgVersion || 'Not found (grep fallback)' })

    // Check Bun version
    checks.push({ label: 'Bun', status: 'ok', detail: `v${Bun.version}` })

    // Check config dir
    checks.push({ label: 'Config', status: existsSync(platform.configDir) ? 'ok' : 'warn', detail: platform.configDir })

    // Check CLAUDE.md
    const hasClaude = existsSync(join(context.workingDir, 'CLAUDE.md'))
    checks.push({ label: 'CLAUDE.md', status: hasClaude ? 'ok' : 'warn', detail: hasClaude ? 'Found' : 'Not found (run /init)' })

    // Check git repo
    const isRepo = Bun.spawnSync(['git', 'rev-parse', '--is-inside-work-tree'], { cwd: context.workingDir, stdout: 'pipe' })
    checks.push({ label: 'Git repo', status: isRepo.exitCode === 0 ? 'ok' : 'warn', detail: isRepo.exitCode === 0 ? 'Yes' : 'Not a git repo' })

    // Platform
    checks.push({ label: 'Platform', status: 'ok', detail: `${process.platform} ${process.arch}` })

    // Shell
    checks.push({ label: 'Shell', status: 'ok', detail: platform.shell })

    // Terminal
    checks.push({ label: 'Terminal', status: 'ok', detail: `${platform.columns}×${platform.rows}` })

    const lines = [theme.bold('Environment Diagnostics:'), '']
    for (const c of checks) {
      const icon = c.status === 'ok' ? theme.success('✓') : c.status === 'warn' ? theme.warning('⚠') : theme.error('✗')
      lines.push(`  ${icon} ${c.label.padEnd(12)} ${c.detail}`)
    }

    return lines.join('\n')
  },
}
