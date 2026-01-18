import { db } from './db';
import { get } from 'svelte/store';
import { isSyncing, isSyncEnabled } from './syncService';
import { addPendingDeletion, type TableName } from './pendingDeletions';

let hooksInitialized = false;
let syncManagerRef: { scheduleSync: () => Promise<void> } | null = null;
let suppressHooks = false;

// Map Dexie table names to our TableName type
const tableNameMap: Record<string, TableName> = {
	exercises: 'exercises',
	workouts: 'workouts',
	sessions: 'sessions',
	personalRecords: 'personalRecords'
};

export function setSuppressHooks(value: boolean): void {
	suppressHooks = value;
}

async function triggerSync(): Promise<void> {
	if (suppressHooks || get(isSyncing) || !isSyncEnabled()) return;

	if (!syncManagerRef) {
		const { syncManager } = await import('./syncUtils');
		syncManagerRef = syncManager;
	}

	await syncManagerRef.scheduleSync();
}

export function initializeDbHooks(): void {
	if (hooksInitialized) return;

	const tables = [db.exercises, db.workouts, db.sessions, db.personalRecords] as const;

	for (const table of tables) {
		table.hook('creating', function (primKey, obj, trans) {
			trans.on('complete', () => triggerSync());
			return primKey;
		});

		table.hook('updating', function (modifications, primKey, obj, trans) {
			trans.on('complete', () => triggerSync());
			return modifications;
		});

		table.hook('deleting', function (primKey, obj, trans) {
			// Capture the deleted record for sync before the transaction completes
			const tableName = tableNameMap[table.name];
			if (tableName && obj && !suppressHooks) {
				addPendingDeletion(tableName, obj as unknown as Record<string, unknown>);
			}
			trans.on('complete', () => triggerSync());
		});
	}

	hooksInitialized = true;
}
