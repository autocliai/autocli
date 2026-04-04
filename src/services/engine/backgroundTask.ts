import { logger } from '../../utils/logger.js'

export interface BackgroundTask {
  id: string
  command: string
  pid: number
  output: string
  exitCode: number | null
  startedAt: string
}

const MAX_TASKS = 5
const MAX_OUTPUT = 1024 * 1024

export class BackgroundTaskManager {
  private tasks = new Map<string, BackgroundTask>()
  private nextId = 1

  async spawn(command: string, cwd: string): Promise<string> {
    if (this.tasks.size >= MAX_TASKS) throw new Error(`Max ${MAX_TASKS} background tasks reached`)
    const id = `bg-${this.nextId++}`
    const proc = Bun.spawn(['bash', '-c', command], { cwd, stdout: 'pipe', stderr: 'pipe' })
    const task: BackgroundTask = { id, command, pid: proc.pid, output: '', exitCode: null, startedAt: new Date().toISOString() }
    this.tasks.set(id, task)
    ;(async () => {
      try {
        const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
        task.exitCode = await proc.exited
        task.output = (stdout + '\n' + stderr).trim().slice(0, MAX_OUTPUT)
      } catch (e) { task.output = `Error: ${e}`; task.exitCode = 1 }
      try { logger.debug('Background task completed', { id, exitCode: task.exitCode }) } catch {}
    })().catch(() => {})
    return id
  }

  get(id: string): BackgroundTask | undefined { return this.tasks.get(id) }
  list(): BackgroundTask[] { return [...this.tasks.values()] }
  isComplete(id: string): boolean { const task = this.tasks.get(id); return task ? task.exitCode !== null : true }
}
