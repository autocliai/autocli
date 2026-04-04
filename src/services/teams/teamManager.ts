import type { Team, Worker, WorkerStatus } from './types.js'

export class TeamManager {
  private teams = new Map<string, Team>()

  create(name: string, goal: string, workers: Omit<Worker, 'status'>[]): Team {
    const team: Team = { name, goal, workers: workers.map(w => ({ ...w, status: 'pending' as WorkerStatus })), createdAt: new Date().toISOString() }
    this.teams.set(name, team)
    return team
  }

  get(name: string): Team | undefined { return this.teams.get(name) }

  updateWorker(teamName: string, workerName: string, update: Partial<Worker>): void {
    const team = this.teams.get(teamName)
    if (!team) return
    const worker = team.workers.find(w => w.name === workerName)
    if (!worker) return
    Object.assign(worker, update)
    if (team.workers.every(w => w.status === 'completed' || w.status === 'failed')) team.completedAt = new Date().toISOString()
  }

  list(): Team[] { return [...this.teams.values()] }
  isComplete(teamName: string): boolean { const team = this.teams.get(teamName); return !!team?.completedAt }
}
