import { describe, it, expect, beforeEach } from 'bun:test'
import { TeamManager } from './teamManager.js'

let mgr: TeamManager

beforeEach(() => {
  mgr = new TeamManager()
})

const tasks = [
  { name: 'worker-1', task: 'Do research' },
  { name: 'worker-2', task: 'Write code' },
]

describe('TeamManager', () => {
  describe('createTeam', () => {
    it('creates a team with correct fields', () => {
      const team = mgr.createTeam('Alpha', 'Build feature', tasks)
      expect(team.name).toBe('Alpha')
      expect(team.goal).toBe('Build feature')
      expect(team.status).toBe('active')
      expect(team.workers.length).toBe(2)
    })

    it('workers have correct initial state', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      for (const w of team.workers) {
        expect(w.status).toBe('pending')
        expect(w.notified).toBe(false)
      }
      expect(team.workers[0].name).toBe('worker-1')
      expect(team.workers[0].task).toBe('Do research')
    })

    it('generates unique team IDs', () => {
      const t1 = mgr.createTeam('A', 'g', tasks)
      const t2 = mgr.createTeam('B', 'g', tasks)
      expect(t1.id).not.toBe(t2.id)
    })
  })

  describe('getTeam', () => {
    it('returns team by ID', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      expect(mgr.getTeam(team.id)).toBeDefined()
      expect(mgr.getTeam(team.id)!.name).toBe('Alpha')
    })

    it('returns undefined for missing ID', () => {
      expect(mgr.getTeam('missing')).toBeUndefined()
    })
  })

  describe('getActiveTeam', () => {
    it('returns first active team', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      expect(mgr.getActiveTeam()!.id).toBe(team.id)
    })

    it('returns undefined when none active', () => {
      const team = mgr.createTeam('Alpha', 'Goal', [{ name: 'w', task: 't' }])
      mgr.completeWorker(team.id, team.workers[0].id, 'done')
      expect(mgr.getActiveTeam()).toBeUndefined()
    })
  })

  describe('listTeams', () => {
    it('returns all teams', () => {
      mgr.createTeam('A', 'g', tasks)
      mgr.createTeam('B', 'g', tasks)
      expect(mgr.listTeams().length).toBe(2)
    })
  })

  describe('worker lifecycle', () => {
    it('startWorker sets status to running', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      const wId = team.workers[0].id
      mgr.startWorker(team.id, wId)
      expect(mgr.getTeam(team.id)!.workers[0].status).toBe('running')
      expect(mgr.getTeam(team.id)!.workers[0].startedAt).toBeDefined()
    })

    it('completeWorker sets status and result', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      const wId = team.workers[0].id
      mgr.completeWorker(team.id, wId, 'done!')
      const w = mgr.getTeam(team.id)!.workers[0]
      expect(w.status).toBe('completed')
      expect(w.result).toBe('done!')
      expect(w.completedAt).toBeDefined()
    })

    it('failWorker sets status and error', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      const wId = team.workers[0].id
      mgr.failWorker(team.id, wId, 'crash')
      const w = mgr.getTeam(team.id)!.workers[0]
      expect(w.status).toBe('failed')
      expect(w.error).toBe('crash')
    })
  })

  describe('team completion', () => {
    it('marks team completed when all workers complete', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      mgr.completeWorker(team.id, team.workers[0].id, 'a')
      expect(mgr.getTeam(team.id)!.status).toBe('active')
      mgr.completeWorker(team.id, team.workers[1].id, 'b')
      expect(mgr.getTeam(team.id)!.status).toBe('completed')
    })

    it('marks team failed when any worker fails', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      mgr.completeWorker(team.id, team.workers[0].id, 'ok')
      mgr.failWorker(team.id, team.workers[1].id, 'error')
      expect(mgr.getTeam(team.id)!.status).toBe('failed')
    })
  })

  describe('getWorker', () => {
    it('finds worker by ID across teams', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      const result = mgr.getWorker(team.workers[0].id)
      expect(result).toBeDefined()
      expect(result!.worker.name).toBe('worker-1')
      expect(result!.team.name).toBe('Alpha')
    })

    it('returns undefined for missing worker', () => {
      expect(mgr.getWorker('missing')).toBeUndefined()
    })
  })

  describe('getPendingNotifications', () => {
    it('returns completed/failed unnotified workers', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      mgr.completeWorker(team.id, team.workers[0].id, 'done')
      const notifs = mgr.getPendingNotifications()
      expect(notifs.length).toBe(1)
      expect(notifs[0].worker.status).toBe('completed')
    })

    it('marks as notified — second call returns empty', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      mgr.completeWorker(team.id, team.workers[0].id, 'done')
      mgr.getPendingNotifications()
      expect(mgr.getPendingNotifications()).toEqual([])
    })

    it('does not include pending/running workers', () => {
      const team = mgr.createTeam('Alpha', 'Goal', tasks)
      mgr.startWorker(team.id, team.workers[0].id)
      expect(mgr.getPendingNotifications()).toEqual([])
    })
  })
})
