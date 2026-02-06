import { db } from './db';
import { setSuppressHooks } from './dbHooks';
import type { Exercise, Workout, Session, PersonalRecord, UserPreferences } from './types';
import { writable, get } from 'svelte/store';
import {
	getAllPendingDeletions,
	clearPendingDeletions,
	type PendingDeletion
} from './pendingDeletions';

const SYNC_KEY_STORAGE = 'gym-app-sync-key';
const LAST_SYNC_STORAGE = 'gym-app-last-sync';

// Sync state store
export const syncKey = writable<string | null>(
	typeof localStorage !== 'undefined' ? localStorage.getItem(SYNC_KEY_STORAGE) : null
);
export const isSyncing = writable(false);
export const isBlockingSync = writable(false);
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

// Transform a deleted record to server format
function transformDeletedRecord(
	deletion: PendingDeletion
): Record<string, unknown> {
	const record = deletion.record;
	const deletedAt = deletion.deletedAt;

	switch (deletion.table) {
		case 'exercises':
			return {
				id: record.id,
				name: record.name,
				category: record.category,
				primary_muscle: record.primary_muscle,
				secondary_muscles: record.secondary_muscles,
				equipment: record.equipment,
				is_custom: record.is_custom ? 1 : 0,
				updated_at: deletedAt,
				deleted_at: deletedAt
			};
		case 'workouts':
			return {
				id: record.id,
				name: record.name,
				exercises: record.exercises,
				notes: record.notes || null,
				created_at: record.createdAt,
				updated_at: deletedAt,
				deleted_at: deletedAt
			};
		case 'sessions':
			return {
				id: record.id,
				workout_id: record.workoutId,
				workout_name: record.workoutName,
				exercises: record.exercises,
				date: record.date,
				duration: record.duration,
				notes: record.notes || null,
				created_at: record.createdAt,
				updated_at: deletedAt,
				deleted_at: deletedAt
			};
		case 'personalRecords':
			return {
				id: record.id,
				exercise_id: record.exerciseId,
				exercise_name: record.exerciseName,
				reps: record.reps,
				weight: record.weight,
				achieved_date: record.achievedDate,
				session_id: record.sessionId,
				updated_at: deletedAt,
				deleted_at: deletedAt
			};
		case 'preferences':
			return {
				id: record.id,
				weight_unit: record.weightUnit,
				distance_unit: record.distanceUnit,
				decimal_places: record.decimalPlaces,
				updated_at: deletedAt,
				deleted_at: deletedAt
			};
		default:
			return record;
	}
}

// Transform local data to server format
function transformToServer(
	exercises: Exercise[],
	workouts: Workout[],
	sessions: Session[],
	personalRecords: PersonalRecord[],
	preferences: UserPreferences[],
	pendingDeletions: PendingDeletion[]
) {
	const now = Date.now();

	// Get deleted records by table
	const deletedExercises = pendingDeletions
		.filter((d) => d.table === 'exercises')
		.map(transformDeletedRecord);
	const deletedWorkouts = pendingDeletions
		.filter((d) => d.table === 'workouts')
		.map(transformDeletedRecord);
	const deletedSessions = pendingDeletions
		.filter((d) => d.table === 'sessions')
		.map(transformDeletedRecord);
	const deletedPersonalRecords = pendingDeletions
		.filter((d) => d.table === 'personalRecords')
		.map(transformDeletedRecord);
	const deletedPreferences = pendingDeletions
		.filter((d) => d.table === 'preferences')
		.map(transformDeletedRecord);

	return {
		exercises: [
			...exercises.map((e) => ({
				id: e.id,
				name: e.name,
				category: e.category,
				primary_muscle: e.primary_muscle,
				secondary_muscles: e.secondary_muscles,
				equipment: e.equipment,
				is_custom: e.is_custom ? 1 : 0,
				updated_at: now,
				deleted_at: null
			})),
			...deletedExercises
		],
		workouts: [
			...workouts.map((w) => ({
				id: w.id,
				name: w.name,
				exercises: w.exercises,
				notes: w.notes || null,
				created_at: w.createdAt,
				updated_at: new Date(w.updatedAt).getTime(),
				deleted_at: null
			})),
			...deletedWorkouts
		],
		sessions: [
			...sessions.map((s) => ({
				id: s.id,
				workout_id: null,
				workout_name: null,
				exercises: s.exercises,
				date: s.date,
				duration: s.duration,
				notes: s.notes || null,
				created_at: s.createdAt,
				updated_at: new Date(s.createdAt).getTime(),
				deleted_at: null
			})),
			...deletedSessions
		],
		personal_records: [
			...personalRecords.map((pr) => ({
				id: pr.id,
				exercise_id: pr.exerciseId,
				exercise_name: pr.exerciseName,
				reps: pr.reps,
				weight: pr.weight,
				achieved_date: pr.achievedDate,
				session_id: pr.sessionId,
				updated_at: new Date(pr.achievedDate).getTime(),
				deleted_at: null
			})),
			...deletedPersonalRecords
		],
		preferences: [
			...preferences.map((p) => ({
				id: p.id,
				weight_unit: p.weightUnit,
				distance_unit: p.distanceUnit,
				decimal_places: p.decimalPlaces,
				updated_at: new Date(p.updatedAt).getTime(),
				deleted_at: null
			})),
			...deletedPreferences
		],
		lastSync: get(lastSyncTime) || 0
	};
}

// Transform server data to local format
function transformFromServer(data: {
	exercises: Array<Record<string, unknown>>;
	workouts: Array<Record<string, unknown>>;
	sessions: Array<Record<string, unknown>>;
	personal_records: Array<Record<string, unknown>>;
	preferences: Array<Record<string, unknown>>;
}): {
	exercises: Exercise[];
	workouts: Workout[];
	sessions: Session[];
	personalRecords: PersonalRecord[];
	preferences: UserPreferences[];
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
		})),
		preferences: (data.preferences || []).map((p) => ({
			id: p.id as string,
			weightUnit: (p.weight_unit as string) === 'lb' ? 'lb' : 'kg',
			distanceUnit: (p.distance_unit as string) === 'miles' ? 'miles' : 'km',
			decimalPlaces: (p.decimal_places as number) ?? 1,
			updatedAt: new Date(p.updated_at as number).toISOString()
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
	const startTime = Date.now();

	try {
		// Get all local data and pending deletions
		const [exercises, workouts, sessions, personalRecords, preferences] = await Promise.all([
			db.exercises.toArray(),
			db.workouts.toArray(),
			db.sessions.toArray(),
			db.personalRecords.toArray(),
			db.preferences.toArray()
		]);
		const pendingDeletions = getAllPendingDeletions();

		// Transform and send to server (including deleted records)
		const payload = transformToServer(exercises, workouts, sessions, personalRecords, preferences, pendingDeletions);

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
		// Suppress hooks during sync writes to prevent recursive sync triggers
		setSuppressHooks(true);
		try {
			await db.transaction(
				'rw',
				[db.exercises, db.workouts, db.sessions, db.personalRecords, db.preferences],
				async () => {
					// Clear and replace each table
					await db.exercises.clear();
					await db.exercises.bulkAdd(serverData.exercises);

					await db.workouts.clear();
					await db.workouts.bulkAdd(serverData.workouts);

					await db.sessions.clear();
					await db.sessions.bulkAdd(serverData.sessions);

					await db.personalRecords.clear();
					await db.personalRecords.bulkAdd(serverData.personalRecords);

					await db.preferences.clear();
					if (serverData.preferences.length > 0) {
						await db.preferences.bulkAdd(serverData.preferences);
					}
				}
			);
		} finally {
			setSuppressHooks(false);
		}

		// Recalculate PRs from synced sessions to ensure consistency
		const { calculatePersonalRecords } = await import('./prUtils');
		await calculatePersonalRecords();

		const syncTimestamp = result.data.syncTimestamp;
		lastSyncTime.set(syncTimestamp);

		// Clear pending deletions after successful sync
		clearPendingDeletions();

		// Refresh preferences store with synced data
		const { preferencesStore } = await import('./stores/preferences.svelte');
		await preferencesStore.refresh();

		// Invalidate all data so load functions re-run with fresh data
		// Use dynamic import to avoid test environment issues with $app/navigation
		const { invalidateAll } = await import('./invalidation');
		await invalidateAll();

		return { success: true, syncTimestamp };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Sync failed' };
	} finally {
		// Ensure minimum 500ms display time for sync indicator
		const elapsed = Date.now() - startTime;
		if (elapsed < 500) {
			await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
		}
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
