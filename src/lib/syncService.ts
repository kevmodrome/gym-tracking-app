import { db } from './db';
import type { Exercise, Workout, Session, PersonalRecord } from './types';
import { writable, get } from 'svelte/store';

const SYNC_KEY_STORAGE = 'gym-app-sync-key';
const LAST_SYNC_STORAGE = 'gym-app-last-sync';

// Sync state store
export const syncKey = writable<string | null>(
	typeof localStorage !== 'undefined' ? localStorage.getItem(SYNC_KEY_STORAGE) : null
);
export const isSyncing = writable(false);
export const lastSyncTime = writable<number | null>(
	typeof localStorage !== 'undefined'
		? parseInt(localStorage.getItem(LAST_SYNC_STORAGE) || '0') || null
		: null
);

// Subscribe to sync key changes and persist
syncKey.subscribe((value) => {
	if (typeof localStorage !== 'undefined') {
		if (value) {
			localStorage.setItem(SYNC_KEY_STORAGE, value);
		} else {
			localStorage.removeItem(SYNC_KEY_STORAGE);
		}
	}
});

lastSyncTime.subscribe((value) => {
	if (typeof localStorage !== 'undefined') {
		if (value) {
			localStorage.setItem(LAST_SYNC_STORAGE, value.toString());
		} else {
			localStorage.removeItem(LAST_SYNC_STORAGE);
		}
	}
});

export interface SyncServiceResult {
	success: boolean;
	error?: string;
	syncTimestamp?: number;
}

// Generate a new sync key
export async function generateSyncKey(): Promise<SyncServiceResult> {
	try {
		const response = await fetch('/api/sync/new', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});

		const data = await response.json();

		if (data.success && data.syncKey) {
			syncKey.set(data.syncKey);
			// Immediately sync local data to the new key
			return syncData();
		}

		return { success: false, error: data.error || 'Failed to generate sync key' };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Network error' };
	}
}

// Set an existing sync key
export async function setSyncKey(key: string): Promise<SyncServiceResult> {
	// Validate format
	if (!/^[a-f0-9-]{36}$/i.test(key)) {
		return { success: false, error: 'Invalid sync key format' };
	}

	// Check if key exists on server
	try {
		const response = await fetch(`/api/sync/${key}`);
		const data = await response.json();

		if (!data.success) {
			return { success: false, error: 'Sync key not found' };
		}

		syncKey.set(key);

		// Pull data from server and merge with local
		return syncData();
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Network error' };
	}
}

// Clear sync key (disconnect from sync)
export function clearSyncKey(): void {
	syncKey.set(null);
	lastSyncTime.set(null);
}

// Transform local data to server format
function transformToServer(exercises: Exercise[], workouts: Workout[], sessions: Session[], personalRecords: PersonalRecord[]) {
	const now = Date.now();

	return {
		exercises: exercises.map((e) => ({
			id: e.id,
			name: e.name,
			category: e.category,
			primary_muscle: e.primary_muscle,
			secondary_muscles: e.secondary_muscles,
			equipment: e.equipment,
			is_custom: e.is_custom ? 1 : 0,
			updated_at: now
		})),
		workouts: workouts.map((w) => ({
			id: w.id,
			name: w.name,
			exercises: w.exercises,
			notes: w.notes || null,
			created_at: w.createdAt,
			updated_at: new Date(w.updatedAt).getTime()
		})),
		sessions: sessions.map((s) => ({
			id: s.id,
			workout_id: s.workoutId,
			workout_name: s.workoutName,
			exercises: s.exercises,
			date: s.date,
			duration: s.duration,
			notes: s.notes || null,
			created_at: s.createdAt,
			updated_at: new Date(s.createdAt).getTime()
		})),
		personal_records: personalRecords.map((pr) => ({
			id: pr.id,
			exercise_id: pr.exerciseId,
			exercise_name: pr.exerciseName,
			reps: pr.reps,
			weight: pr.weight,
			achieved_date: pr.achievedDate,
			session_id: pr.sessionId,
			updated_at: new Date(pr.achievedDate).getTime()
		})),
		lastSync: get(lastSyncTime) || 0
	};
}

// Transform server data to local format
function transformFromServer(data: {
	exercises: Array<Record<string, unknown>>;
	workouts: Array<Record<string, unknown>>;
	sessions: Array<Record<string, unknown>>;
	personal_records: Array<Record<string, unknown>>;
}): {
	exercises: Exercise[];
	workouts: Workout[];
	sessions: Session[];
	personalRecords: PersonalRecord[];
} {
	return {
		exercises: data.exercises.map((e) => ({
			id: e.id as string,
			name: e.name as string,
			category: e.category as Exercise['category'],
			primary_muscle: e.primary_muscle as Exercise['primary_muscle'],
			secondary_muscles: (e.secondary_muscles as string[]) || [],
			equipment: (e.equipment as string) || '',
			is_custom: Boolean(e.is_custom)
		})),
		workouts: data.workouts.map((w) => ({
			id: w.id as string,
			name: w.name as string,
			exercises: (w.exercises as Workout['exercises']) || [],
			notes: (w.notes as string) || undefined,
			createdAt: w.created_at as string,
			updatedAt: new Date(w.updated_at as number).toISOString()
		})),
		sessions: data.sessions.map((s) => ({
			id: s.id as string,
			workoutId: s.workout_id as string,
			workoutName: s.workout_name as string,
			exercises: (s.exercises as Session['exercises']) || [],
			date: s.date as string,
			duration: s.duration as number,
			notes: (s.notes as string) || undefined,
			createdAt: s.created_at as string
		})),
		personalRecords: data.personal_records.map((pr) => ({
			id: pr.id as string,
			exerciseId: pr.exercise_id as string,
			exerciseName: pr.exercise_name as string,
			reps: pr.reps as number,
			weight: pr.weight as number,
			achievedDate: pr.achieved_date as string,
			sessionId: pr.session_id as string
		}))
	};
}

// Sync data with server
export async function syncData(): Promise<SyncServiceResult> {
	const key = get(syncKey);
	if (!key) {
		return { success: false, error: 'No sync key configured' };
	}

	if (get(isSyncing)) {
		return { success: false, error: 'Sync already in progress' };
	}

	isSyncing.set(true);

	try {
		// Get all local data
		const [exercises, workouts, sessions, personalRecords] = await Promise.all([
			db.exercises.toArray(),
			db.workouts.toArray(),
			db.sessions.toArray(),
			db.personalRecords.toArray()
		]);

		// Transform and send to server
		const payload = transformToServer(exercises, workouts, sessions, personalRecords);

		const response = await fetch(`/api/sync/${key}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		const result = await response.json();

		if (!result.success) {
			return { success: false, error: result.error || 'Sync failed' };
		}

		// Transform server data back to local format
		const serverData = transformFromServer(result.data);

		// Replace local data with merged server data
		await db.transaction('rw', [db.exercises, db.workouts, db.sessions, db.personalRecords], async () => {
			// Clear and replace each table
			await db.exercises.clear();
			await db.exercises.bulkAdd(serverData.exercises);

			await db.workouts.clear();
			await db.workouts.bulkAdd(serverData.workouts);

			await db.sessions.clear();
			await db.sessions.bulkAdd(serverData.sessions);

			await db.personalRecords.clear();
			await db.personalRecords.bulkAdd(serverData.personalRecords);
		});

		const syncTimestamp = result.data.syncTimestamp;
		lastSyncTime.set(syncTimestamp);

		return { success: true, syncTimestamp };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Sync failed' };
	} finally {
		isSyncing.set(false);
	}
}

// Check if sync is enabled
export function isSyncEnabled(): boolean {
	return get(syncKey) !== null;
}

// Get the current sync key
export function getSyncKey(): string | null {
	return get(syncKey);
}
