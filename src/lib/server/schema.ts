export const SCHEMA = `
-- exercises table
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT,
  equipment TEXT,
  is_custom INTEGER DEFAULT 1,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

-- workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  exercises TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

-- sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL,
  workout_name TEXT NOT NULL,
  exercises TEXT NOT NULL,
  date TEXT NOT NULL,
  duration INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

-- personal_records table
CREATE TABLE IF NOT EXISTS personal_records (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  reps INTEGER NOT NULL,
  weight REAL NOT NULL,
  achieved_date TEXT NOT NULL,
  session_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

-- sync metadata
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export const TABLES = ['exercises', 'workouts', 'sessions', 'personal_records'] as const;
export type TableName = (typeof TABLES)[number];
