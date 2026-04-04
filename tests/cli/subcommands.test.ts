import { describe, test, expect } from 'bun:test'

// Integration tests: run autocli as a subprocess and check output

async function run(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bun', 'src/index.ts', ...args], {
    cwd: '/home/linaro/Project/autocli',
    stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, NO_COLOR: '1' },
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const exitCode = await proc.exited
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

describe('CLI --version and --help', () => {
  test('--version prints version', async () => {
    const { stdout, exitCode } = await run('--version')
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/^autocli v\d+\.\d+\.\d+$/)
  })

  test('-v prints version', async () => {
    const { stdout, exitCode } = await run('-v')
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/^autocli v/)
  })

  test('--help prints usage', async () => {
    const { stdout, exitCode } = await run('--help')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage:')
    expect(stdout).toContain('Commands:')
    expect(stdout).toContain('Options:')
  })

  test('-h prints usage', async () => {
    const { stdout, exitCode } = await run('-h')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage:')
  })
})

describe('CLI subcommand: help', () => {
  test('autocli help prints usage', async () => {
    const { stdout, exitCode } = await run('help')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage:')
    expect(stdout).toContain('Commands:')
  })
})

describe('CLI subcommand: doctor', () => {
  test('autocli doctor shows diagnostics', async () => {
    const { stdout, exitCode } = await run('doctor')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('API Key')
    expect(stdout).toContain('Git')
    expect(stdout).toContain('Bun')
    expect(stdout).toContain('Platform')
  })
})

describe('CLI subcommand: brain', () => {
  test('autocli brain shows stats', async () => {
    const { stdout, exitCode } = await run('brain')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Second Brain')
    expect(stdout).toContain('Total notes')
  })

  test('autocli brain stats shows stats', async () => {
    const { stdout, exitCode } = await run('brain', 'stats')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Total notes')
  })

  test('autocli brain search without query shows usage', async () => {
    const { stdout, exitCode } = await run('brain', 'search')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage')
  })
})

describe('CLI subcommand: skills', () => {
  test('autocli skills lists skills or shows empty', async () => {
    const { stdout, exitCode } = await run('skills')
    expect(exitCode).toBe(0)
    const valid = stdout.includes('No skills') || stdout.includes('Available skills')
    expect(valid).toBe(true)
  })
})

describe('CLI subcommand: agents', () => {
  test('autocli agents lists agents', async () => {
    const { stdout, exitCode } = await run('agents')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Agents')
  })

  test('autocli agents list works', async () => {
    const { stdout, exitCode } = await run('agents', 'list')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Agents')
  })
})

describe('CLI subcommand: schedule', () => {
  test('autocli schedule lists schedules', async () => {
    const { stdout, exitCode } = await run('schedule')
    expect(exitCode).toBe(0)
    // Either shows schedules or "No schedules configured"
    expect(stdout.length).toBeGreaterThan(0)
  })

  test('autocli schedule list works', async () => {
    const { stdout, exitCode } = await run('schedule', 'list')
    expect(exitCode).toBe(0)
    expect(stdout.length).toBeGreaterThan(0)
  })
})

describe('CLI subcommand: status', () => {
  test('autocli status shows status', async () => {
    const { stdout, exitCode } = await run('status')
    expect(exitCode).toBe(0)
    // Shows schedules and/or agents or "No schedules"
    expect(stdout.length).toBeGreaterThan(0)
  })
})

describe('CLI subcommand: permissions', () => {
  test('autocli permissions shows mode', async () => {
    const { stdout, exitCode } = await run('permissions')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Permission mode')
  })

  test('autocli perms alias works', async () => {
    const { stdout, exitCode } = await run('perms')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Permission mode')
  })
})

describe('CLI subcommand: activate', () => {
  test('autocli activate shows license status', async () => {
    const { stdout, exitCode } = await run('activate')
    expect(exitCode).toBe(0)
    const valid = stdout.includes('License') || stdout.includes('No license')
    expect(valid).toBe(true)
  })

  test('autocli activate with bad key shows error', async () => {
    const { stdout, exitCode } = await run('activate', 'badkey')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Invalid')
  })
})

describe('CLI subcommand: tasks', () => {
  test('autocli tasks shows message', async () => {
    const { stdout, exitCode } = await run('tasks')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('No background tasks')
  })
})

describe('CLI subcommand: team', () => {
  test('autocli team shows status', async () => {
    const { stdout, exitCode } = await run('team')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('No active teams')
  })
})

describe('CLI subcommand: plan', () => {
  test('autocli plan shows flag hint', async () => {
    const { stdout, exitCode } = await run('plan')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('--plan')
  })
})

describe('CLI subcommand: yolo', () => {
  test('autocli yolo shows flag hint', async () => {
    const { stdout, exitCode } = await run('yolo')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('--yolo')
  })
})
