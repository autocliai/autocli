export type WorkerStatus = 'pending' | 'running' | 'completed' | 'failed'
export interface Worker { name: string; agentName: string; task: string; status: WorkerStatus; result?: string; error?: string; startedAt?: string; completedAt?: string }
export interface Team { name: string; goal: string; workers: Worker[]; createdAt: string; completedAt?: string }
