import type { Tablinum } from 'tablinum/svelte';

const OLD_DB_NAME = 'gym-recording-app-db';
const MIGRATION_FLAG = 'gym-app-migrated-to-tablinum';

/**
 * Check if old Dexie database exists and migrate data to Tablinum.
 * Uses raw IndexedDB API to avoid importing Dexie.
 */
export async function migrateFromDexieIfNeeded(db: Tablinum<any>): Promise<void> {
	// Skip if already migrated
	if (localStorage.getItem(MIGRATION_FLAG)) return;

	// Check if old database exists
	const databases = await indexedDB.databases();
	const oldDbExists = databases.some((d) => d.name === OLD_DB_NAME);
	if (!oldDbExists) {
		localStorage.setItem(MIGRATION_FLAG, 'true');
		return;
	}

	console.log('[Migration] Found old Dexie database, starting migration...');

	try {
		const oldData = await readOldDatabase();
		if (!oldData) {
			console.log('[Migration] No data to migrate');
			localStorage.setItem(MIGRATION_FLAG, 'true');
			return;
		}

		// Build exercise ID mapping (old ID -> new Tablinum ID)
		const exerciseIdMap = new Map<string, string>();

		// Migrate exercises
		for (const exercise of oldData.exercises) {
			const { id, ...data } = exercise;
			const newId = await db.collection('exercises').add(data);
			exerciseIdMap.set(id, newId);
		}
		console.log(`[Migration] Migrated ${oldData.exercises.length} exercises`);

		// Migrate workouts (rewrite exerciseId references)
		for (const workout of oldData.workouts) {
			const { id, ...data } = workout;
			if (Array.isArray(data.exercises)) {
				data.exercises = data.exercises.map((ex: any) => ({
					...ex,
					exerciseId: exerciseIdMap.get(ex.exerciseId) ?? ex.exerciseId
				}));
			}
			await db.collection('workouts').add(data);
		}
		console.log(`[Migration] Migrated ${oldData.workouts.length} workouts`);

		// Migrate sessions (rewrite exerciseId references)
		for (const session of oldData.sessions) {
			const { id, workoutId, workoutName, ...data } = session;
			if (Array.isArray(data.exercises)) {
				data.exercises = data.exercises.map((ex: any) => ({
					...ex,
					exerciseId: exerciseIdMap.get(ex.exerciseId) ?? ex.exerciseId
				}));
			}
			await db.collection('sessions').add({ ...data, status: 'completed' });
		}
		console.log(`[Migration] Migrated ${oldData.sessions.length} sessions`);

		// Migrate personal records (rewrite exerciseId references)
		for (const pr of oldData.personalRecords) {
			const { id, ...data } = pr;
			data.exerciseId = exerciseIdMap.get(data.exerciseId) ?? data.exerciseId;
			await db.collection('personalRecords').add(data);
		}
		console.log(`[Migration] Migrated ${oldData.personalRecords.length} personal records`);

		// Migrate preferences
		for (const pref of oldData.preferences) {
			const { id, ...data } = pref;
			await db.collection('preferences').add(data);
		}
		console.log(`[Migration] Migrated ${oldData.preferences.length} preferences`);

		// Mark migration complete
		localStorage.setItem(MIGRATION_FLAG, 'true');

		// Clean up old sync-related localStorage keys
		localStorage.removeItem('gym-app-sync-key');
		localStorage.removeItem('gym-app-last-sync');
		localStorage.removeItem('gym-app-pending-deletions');

		// Delete old database
		await deleteOldDatabase();
		console.log('[Migration] Migration complete, old database deleted');
	} catch (error) {
		console.error('[Migration] Migration failed:', error);
		// Don't set the flag so migration can be retried
	}
}

interface OldData {
	exercises: any[];
	workouts: any[];
	sessions: any[];
	personalRecords: any[];
	preferences: any[];
}

async function readOldDatabase(): Promise<OldData | null> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(OLD_DB_NAME);

		request.onerror = () => reject(request.error);

		request.onsuccess = () => {
			const idb = request.result;
			const storeNames = Array.from(idb.objectStoreNames);

			const data: OldData = {
				exercises: [],
				workouts: [],
				sessions: [],
				personalRecords: [],
				preferences: []
			};

			if (storeNames.length === 0) {
				idb.close();
				resolve(null);
				return;
			}

			const tx = idb.transaction(storeNames, 'readonly');
			let pending = 0;

			function readStore(storeName: string, target: keyof OldData) {
				if (!storeNames.includes(storeName)) return;
				pending++;
				const store = tx.objectStore(storeName);
				const req = store.getAll();
				req.onsuccess = () => {
					data[target] = req.result || [];
					pending--;
					if (pending === 0) {
						idb.close();
						resolve(data);
					}
				};
				req.onerror = () => {
					pending--;
					if (pending === 0) {
						idb.close();
						resolve(data);
					}
				};
			}

			readStore('exercises', 'exercises');
			readStore('workouts', 'workouts');
			readStore('sessions', 'sessions');
			readStore('personalRecords', 'personalRecords');
			readStore('preferences', 'preferences');

			// If no stores matched, resolve immediately
			if (pending === 0) {
				idb.close();
				resolve(data);
			}
		};
	});
}

function deleteOldDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(OLD_DB_NAME);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

const IN_PROGRESS_MIGRATION_FLAG = 'gym-app-in-progress-migrated';
const IN_PROGRESS_KEY_PREFIX = 'gym-app-session-';

export async function migrateInProgressSessions(db: Tablinum<any>): Promise<void> {
	if (typeof localStorage === 'undefined') return;
	if (localStorage.getItem(IN_PROGRESS_MIGRATION_FLAG)) return;

	const keys: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith(IN_PROGRESS_KEY_PREFIX)) keys.push(key);
	}

	for (const key of keys) {
		const raw = localStorage.getItem(key);
		if (!raw) continue;
		let data: any;
		try {
			data = JSON.parse(raw);
		} catch {
			localStorage.removeItem(key);
			continue;
		}

		const start = typeof data.sessionStartTime === 'number'
			? data.sessionStartTime
			: Date.now();
		const isoStart = new Date(start).toISOString();

		try {
			await db.collection('sessions').add({
				exercises: Array.isArray(data.sessionExercises) ? data.sessionExercises : [],
				date: isoStart,
				duration: typeof data.sessionDuration === 'number' ? data.sessionDuration : 0,
				notes: data.sessionNotes || undefined,
				createdAt: isoStart,
				status: 'in_progress',
				currentExerciseIndex: typeof data.currentExerciseIndex === 'number'
					? data.currentExerciseIndex
					: undefined,
				currentSetIndex: typeof data.currentSetIndex === 'number'
					? data.currentSetIndex
					: undefined,
			});
			localStorage.removeItem(key);
		} catch (e) {
			console.error('[Migration] Failed to migrate in-progress session', key, e);
			// Leave the localStorage entry; do not set the flag below if any failed.
			return;
		}
	}

	localStorage.setItem(IN_PROGRESS_MIGRATION_FLAG, 'true');
}
