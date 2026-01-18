import type Database from 'better-sqlite3';
import { TABLES, type TableName } from './schema';

export interface SyncPayload {
	exercises: SyncRecord[];
	workouts: SyncRecord[];
	sessions: SyncRecord[];
	personal_records: SyncRecord[];
	lastSync: number;
}

export interface SyncRecord {
	id: string;
	updated_at: number;
	[key: string]: unknown;
}

export interface SyncResult {
	exercises: SyncRecord[];
	workouts: SyncRecord[];
	sessions: SyncRecord[];
	personal_records: SyncRecord[];
	syncTimestamp: number;
}

// Column definitions for each table
const TABLE_COLUMNS: Record<TableName, string[]> = {
	exercises: [
		'id',
		'name',
		'category',
		'primary_muscle',
		'secondary_muscles',
		'equipment',
		'is_custom',
		'updated_at',
		'deleted_at'
	],
	workouts: ['id', 'name', 'exercises', 'notes', 'created_at', 'updated_at', 'deleted_at'],
	sessions: [
		'id',
		'workout_id',
		'workout_name',
		'exercises',
		'date',
		'duration',
		'notes',
		'created_at',
		'updated_at',
		'deleted_at'
	],
	personal_records: [
		'id',
		'exercise_id',
		'exercise_name',
		'reps',
		'weight',
		'achieved_date',
		'session_id',
		'updated_at',
		'deleted_at'
	]
};

export function mergeAndSync(db: Database.Database, payload: SyncPayload): SyncResult {
	const syncTimestamp = Date.now();

	// Process each table
	for (const table of TABLES) {
		const incomingRecords = payload[table] || [];
		mergeTable(db, table, incomingRecords);
	}

	// Update last sync timestamp
	db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run(
		'last_sync',
		syncTimestamp.toString()
	);

	// Return all data from database
	return {
		exercises: getAllRecords(db, 'exercises'),
		workouts: getAllRecords(db, 'workouts'),
		sessions: getAllRecords(db, 'sessions'),
		personal_records: getAllRecords(db, 'personal_records'),
		syncTimestamp
	};
}

function mergeTable(db: Database.Database, table: TableName, incomingRecords: SyncRecord[]): void {
	const columns = TABLE_COLUMNS[table];

	for (const record of incomingRecords) {
		// Check if record exists and get its updated_at
		const existing = db
			.prepare(`SELECT updated_at FROM ${table} WHERE id = ?`)
			.get(record.id) as { updated_at: number } | undefined;

		// If record doesn't exist or incoming is newer, upsert it
		if (!existing || record.updated_at > existing.updated_at) {
			const placeholders = columns.map(() => '?').join(', ');
			const values = columns.map((col) => {
				const value = record[col];
				// Handle JSON arrays/objects
				if (typeof value === 'object' && value !== null) {
					return JSON.stringify(value);
				}
				return value;
			});

			db.prepare(
				`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
			).run(...values);
		}
	}
}

function getAllRecords(db: Database.Database, table: TableName): SyncRecord[] {
	// Only return non-deleted records
	const rows = db.prepare(`SELECT * FROM ${table} WHERE deleted_at IS NULL`).all() as SyncRecord[];

	// Parse JSON fields
	return rows.map((row) => {
		const parsed = { ...row };
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
				try {
					parsed[key] = JSON.parse(value);
				} catch {
					// Keep original value if not valid JSON
				}
			}
		}
		return parsed;
	});
}

export function getLastSyncTimestamp(db: Database.Database): number {
	const row = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").get() as
		| { value: string }
		| undefined;
	return row ? parseInt(row.value, 10) : 0;
}
