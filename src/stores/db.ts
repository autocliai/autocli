import { Database } from 'bun:sqlite'
import { logger } from '../utils/logger.js'

let db: Database | null = null

export function initDatabase(dbPath: string): void {
  if (db) return
  db = new Database(dbPath, { create: true })
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  runMigrations()
  logger.info('Database initialized', { path: dbPath })
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        working_dir TEXT,
        total_cost REAL DEFAULT 0,
        total_tokens_in INTEGER DEFAULT 0,
        total_tokens_out INTEGER DEFAULT 0,
        model TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_messages_session ON messages(session_id, id);

      CREATE VIRTUAL TABLE memory_fts USING fts5(
        name, description, type, content, file_path,
        tokenize='porter unicode61'
      );

      CREATE VIRTUAL TABLE brain_fts USING fts5(
        title, category, tags, content, file_path,
        tokenize='porter unicode61'
      );

      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        active_form TEXT,
        owner TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE task_deps (
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        blocked_by INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, blocked_by)
      );

      CREATE TABLE agents (
        name TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        model TEXT,
        provider TEXT,
        tools TEXT,
        instructions_path TEXT,
        soul_path TEXT,
        memory_path TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE teams (
        name TEXT PRIMARY KEY,
        goal TEXT,
        template_path TEXT,
        working_dir TEXT,
        agents TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_name TEXT NOT NULL,
        interval TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        working_dir TEXT,
        next_run TEXT,
        last_run TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE job_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER REFERENCES schedules(id),
        team_name TEXT,
        status TEXT,
        agents TEXT,
        started_at TEXT,
        finished_at TEXT
      );

      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `,
  },
]

export function runMigrations(): void {
  if (!db) throw new Error('Database not initialized')

  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  )`)

  const applied = new Set(
    (db.query('SELECT version FROM migrations').all() as { version: number }[])
      .map(r => r.version)
  )

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue
    db.exec(migration.sql)
    db.query('INSERT INTO migrations (version) VALUES (?)').run(migration.version)
    logger.info('Applied migration', { version: migration.version })
  }
}
