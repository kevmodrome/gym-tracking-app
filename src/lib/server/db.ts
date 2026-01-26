import Database from 'better-sqlite3';
import { SCHEMA, TABLES } from './schema';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
	fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Cache of open database connections
const dbCache = new Map<string, Database.Database>();

// Check if a column exists in a table
function columnExists(db: Database.Database, table: string, column: string): boolean {
	const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
	return columns.some((col) => col.name === column);
}

// Migrate database schema to add missing columns
function migrateDatabase(db: Database.Database): void {
	for (const table of TABLES) {
		if (!columnExists(db, table, 'deleted_at')) {
			db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at INTEGER`);
		}
	}
	// Add favorited column to exercises if missing
	if (!columnExists(db, 'exercises', 'favorited')) {
		db.exec(`ALTER TABLE exercises ADD COLUMN favorited INTEGER DEFAULT 0`);
	}
}

export function getDatabase(syncKey: string): Database.Database {
	// Validate sync key format (UUID)
	if (!/^[a-f0-9-]{36}$/i.test(syncKey)) {
		throw new Error('Invalid sync key format');
	}

	// Return cached connection if available
	if (dbCache.has(syncKey)) {
		return dbCache.get(syncKey)!;
	}

	const dbPath = path.join(DATA_DIR, `${syncKey}.db`);
	const db = new Database(dbPath);

	// Enable WAL mode for better concurrent access
	db.pragma('journal_mode = WAL');

	// Initialize schema
	db.exec(SCHEMA);

	// Run migrations for existing databases
	migrateDatabase(db);

	// Cache the connection
	dbCache.set(syncKey, db);

	return db;
}

export function databaseExists(syncKey: string): boolean {
	if (!/^[a-f0-9-]{36}$/i.test(syncKey)) {
		return false;
	}
	const dbPath = path.join(DATA_DIR, `${syncKey}.db`);
	return fs.existsSync(dbPath);
}

export function createDatabase(syncKey: string): Database.Database {
	const db = getDatabase(syncKey);

	// Set creation timestamp
	const now = Date.now();
	db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run(
		'created_at',
		now.toString()
	);

	return db;
}

export function closeDatabase(syncKey: string): void {
	const db = dbCache.get(syncKey);
	if (db) {
		db.close();
		dbCache.delete(syncKey);
	}
}

export function closeAllDatabases(): void {
	for (const [key, db] of dbCache) {
		db.close();
		dbCache.delete(key);
	}
}

// Clean up on process exit
process.on('exit', closeAllDatabases);
process.on('SIGINT', () => {
	closeAllDatabases();
	process.exit(0);
});
process.on('SIGTERM', () => {
	closeAllDatabases();
	process.exit(0);
});
