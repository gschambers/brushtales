import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'

export interface DatabaseRunResult {
  changes: number
  lastInsertRowId: number
}

export interface DatabasePort {
  execAsync(source: string): Promise<void>
  runAsync(source: string, params?: readonly unknown[]): Promise<DatabaseRunResult>
  getFirstAsync<T>(source: string, params?: readonly unknown[]): Promise<T | null>
  getAllAsync<T>(source: string, params?: readonly unknown[]): Promise<T[]>
}

export const DATABASE_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY NOT NULL,
  nickname TEXT NOT NULL,
  age_band TEXT NOT NULL CHECK (age_band IN ('4-5', '6-7', '8-9')),
  avatar_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL,
  completed INTEGER NOT NULL,
  completed_duration_ms INTEGER NOT NULL,
  engagement_band TEXT NOT NULL CHECK (engagement_band IN ('low', 'steady', 'strong')),
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  interrupted INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS session_summaries_profile_id_idx
  ON session_summaries(profile_id, created_at);
`

class ExpoDatabasePort implements DatabasePort {
  constructor(private readonly database: SQLiteDatabase) {}

  execAsync(source: string) {
    return this.database.execAsync(source)
  }

  runAsync(source: string, params: readonly unknown[] = []) {
    return this.database.runAsync(source, params as never)
  }

  getFirstAsync<T>(source: string, params: readonly unknown[] = []) {
    return this.database.getFirstAsync<T>(source, params as never)
  }

  getAllAsync<T>(source: string, params: readonly unknown[] = []) {
    return this.database.getAllAsync<T>(source, params as never)
  }
}

export async function openAppDatabase(): Promise<DatabasePort> {
  const database = await openDatabaseAsync('brushtales.db')
  const port = new ExpoDatabasePort(database)
  await migrateDatabase(port)
  return port
}

export function migrateDatabase(database: DatabasePort): Promise<void> {
  return database.execAsync(DATABASE_SCHEMA)
}
