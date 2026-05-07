import type { Exercise, Workout, Session, PersonalRecord } from './types';
import { db } from './db';
import { calculatePersonalRecords } from './prUtils';

export interface BackupData {
	version: string;
	exportedAt: string;
	exercises: Exercise[];
	workouts: Workout[];
	sessions: Session[];
	personalRecords: PersonalRecord[];
}

export interface ImportResult {
	success: boolean;
	totalItems: number;
	importedItems: number;
	skippedItems: number;
	replacedItems: number;
	errors: string[];
	duplicates: {
		exercises: string[];
		workouts: string[];
		sessions: string[];
		personalRecords: string[];
	};
}

export interface DuplicateResolution {
	exercises: 'replace' | 'skip' | 'merge';
	workouts: 'replace' | 'skip' | 'merge';
	sessions: 'replace' | 'skip' | 'merge';
	personalRecords: 'replace' | 'skip' | 'merge';
}

export interface ExportResult {
	success: boolean;
	totalItems: number;
	message: string;
}

export async function exportBackupData(
	onProgress?: (current: number, total: number, stage: string) => void
): Promise<ExportResult> {
	let totalItems = 0;
	let currentItems = 0;

	try {
		onProgress?.(0, 0, 'Loading exercises...');
		const exercises = await db.collection('exercises').get() as Exercise[];
		currentItems += exercises.length;
		totalItems += exercises.length;
		onProgress?.(currentItems, totalItems, 'Loading exercises...');

		onProgress?.(currentItems, totalItems, 'Loading workouts...');
		const workouts = await db.collection('workouts').get() as Workout[];
		currentItems += workouts.length;
		totalItems += workouts.length;
		onProgress?.(currentItems, totalItems, 'Loading workouts...');

		onProgress?.(currentItems, totalItems, 'Loading sessions...');
		const sessions = await db.collection('sessions').get() as Session[];
		currentItems += sessions.length;
		totalItems += sessions.length;
		onProgress?.(currentItems, totalItems, 'Loading sessions...');

		onProgress?.(currentItems, totalItems, 'Loading personal records...');
		const personalRecords = await db.collection('personalRecords').get() as PersonalRecord[];
		currentItems += personalRecords.length;
		totalItems += personalRecords.length;
		onProgress?.(currentItems, totalItems, 'Loading personal records...');

		const backup: BackupData = {
			version: '1.0.0',
			exportedAt: new Date().toISOString(),
			exercises,
			workouts,
			sessions,
			personalRecords
		};

		onProgress?.(totalItems, totalItems, 'Generating file...');
		const jsonString = JSON.stringify(backup, null, 2);

		onProgress?.(totalItems, totalItems, 'Downloading...');
		const blob = new Blob([jsonString], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
		a.download = `gym-workout-backup-${timestamp}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		return {
			success: true,
			totalItems,
			message: `Successfully exported ${totalItems} items (${exercises.length} exercises, ${workouts.length} workouts, ${sessions.length} sessions, ${personalRecords.length} personal records)`
		};
	} catch (error) {
		return {
			success: false,
			totalItems,
			message: error instanceof Error ? error.message : 'Unknown error occurred during export'
		};
	}
}

export async function validateBackupData(data: unknown): Promise<BackupData | null> {
	if (!data || typeof data !== 'object') {
		return null;
	}

	const backup = data as Record<string, unknown>;

	if (typeof backup.version !== 'string' || typeof backup.exportedAt !== 'string') {
		return null;
	}

	const requiredKeys = ['exercises', 'workouts', 'sessions', 'personalRecords'];
	for (const key of requiredKeys) {
		if (!Array.isArray(backup[key])) {
			return null;
		}
	}

	const validatedBackup = {
		version: backup.version as string,
		exportedAt: backup.exportedAt as string,
		exercises: backup.exercises as Exercise[],
		workouts: backup.workouts as Workout[],
		sessions: backup.sessions as Session[],
		personalRecords: backup.personalRecords as PersonalRecord[]
	};

	return validatedBackup;
}

export async function detectDuplicates(backup: BackupData): Promise<{
	exercises: string[];
	workouts: string[];
	sessions: string[];
	personalRecords: string[];
}> {
	const duplicates = {
		exercises: [] as string[],
		workouts: [] as string[],
		sessions: [] as string[],
		personalRecords: [] as string[]
	};

	const existingExercises = await db.collection('exercises').get() as Exercise[];
	const existingWorkouts = await db.collection('workouts').get() as Workout[];
	const existingSessions = await db.collection('sessions').get() as Session[];
	const existingPRs = await db.collection('personalRecords').get() as PersonalRecord[];

	const existingExerciseNames = new Set(existingExercises.map((e) => e.name));
	const existingWorkoutNames = new Set(existingWorkouts.map((w) => w.name));
	const existingSessionDates = new Set(existingSessions.map((s) => s.date));
	const existingPRKeys = new Set(existingPRs.map((pr) => `${pr.exerciseId}-${pr.reps}`));

	for (const exercise of backup.exercises) {
		if (existingExerciseNames.has(exercise.name)) {
			duplicates.exercises.push(`${exercise.name}`);
		}
	}

	for (const workout of backup.workouts) {
		if (existingWorkoutNames.has(workout.name)) {
			duplicates.workouts.push(`${workout.name}`);
		}
	}

	for (const session of backup.sessions) {
		if (existingSessionDates.has(session.date)) {
			duplicates.sessions.push(`Session from ${new Date(session.date).toLocaleDateString()}`);
		}
	}

	for (const pr of backup.personalRecords) {
		if (existingPRKeys.has(`${pr.exerciseId}-${pr.reps}`)) {
			duplicates.personalRecords.push(`${pr.exerciseName}`);
		}
	}

	return duplicates;
}

// Strip unknown fields so Tablinum validation doesn't reject legacy backup data
function pickExerciseFields(data: Record<string, any>) {
	return {
		name: data.name,
		category: data.category,
		primary_muscle: data.primary_muscle,
		secondary_muscles: data.secondary_muscles,
		equipment: data.equipment,
		is_custom: data.is_custom,
		...(data.favorited != null ? { favorited: data.favorited } : {})
	};
}

function pickWorkoutFields(data: Record<string, any>) {
	return {
		name: data.name,
		exercises: data.exercises,
		createdAt: data.createdAt,
		updatedAt: data.updatedAt,
		...(data.notes != null ? { notes: data.notes } : {})
	};
}

function pickSessionFields(data: Record<string, any>) {
	return {
		exercises: data.exercises,
		date: data.date,
		duration: data.duration,
		createdAt: data.createdAt,
		...(data.notes != null ? { notes: data.notes } : {})
	};
}

function pickPRFields(data: Record<string, any>) {
	return {
		exerciseId: data.exerciseId,
		exerciseName: data.exerciseName,
		reps: data.reps,
		weight: data.weight,
		achievedDate: data.achievedDate,
		sessionId: data.sessionId
	};
}

export async function importBackupData(
	backup: BackupData,
	resolution: DuplicateResolution,
	signal?: AbortSignal
): Promise<ImportResult> {
	const result: ImportResult = {
		success: true,
		totalItems: 0,
		importedItems: 0,
		skippedItems: 0,
		replacedItems: 0,
		errors: [],
		duplicates: {
			exercises: [],
			workouts: [],
			sessions: [],
			personalRecords: []
		}
	};

	// Round-trip through JSON to strip Svelte reactivity proxies before writing to IndexedDB
	backup = JSON.parse(JSON.stringify(backup));

	try {
		// Deduplicate within the backup itself (e.g. duplicate exercises from multi-device sync)
		const deduplicatedExercises: Exercise[] = [];
		const backupExerciseIdMap = new Map<string, string>(); // maps duplicate backup IDs to the kept ID
		const seenExerciseNames = new Set<string>();
		for (const exercise of backup.exercises) {
			if (seenExerciseNames.has(exercise.name)) {
				// Find the first occurrence's ID to remap references
				const keptExercise = deduplicatedExercises.find((e) => e.name === exercise.name)!;
				backupExerciseIdMap.set(exercise.id, keptExercise.id);
				result.skippedItems++;
			} else {
				seenExerciseNames.add(exercise.name);
				deduplicatedExercises.push(exercise);
			}
		}

		const deduplicatedWorkouts: Workout[] = [];
		const seenWorkoutNames = new Set<string>();
		for (const workout of backup.workouts) {
			if (seenWorkoutNames.has(workout.name)) {
				result.skippedItems++;
			} else {
				seenWorkoutNames.add(workout.name);
				deduplicatedWorkouts.push(workout);
			}
		}

		const deduplicatedSessions: Session[] = [];
		const seenSessionDates = new Set<string>();
		for (const session of backup.sessions) {
			if (seenSessionDates.has(session.date)) {
				result.skippedItems++;
			} else {
				seenSessionDates.add(session.date);
				deduplicatedSessions.push(session);
			}
		}

		// Remap exercise IDs in deduplicated data to point to the kept exercises
		for (const session of deduplicatedSessions) {
			for (const ex of session.exercises) {
				ex.exerciseId = backupExerciseIdMap.get(ex.exerciseId) ?? ex.exerciseId;
			}
		}
		for (const workout of deduplicatedWorkouts) {
			for (const ex of workout.exercises) {
				ex.exerciseId = backupExerciseIdMap.get(ex.exerciseId) ?? ex.exerciseId;
			}
		}
		// Build maps of existing records by natural key
		const existingExercises = await db.collection('exercises').get() as Exercise[];
		const existingWorkouts = await db.collection('workouts').get() as Workout[];
		const existingSessions = await db.collection('sessions').get() as Session[];
		const exerciseByName = new Map(existingExercises.map((e) => [e.name, e]));
		const workoutByName = new Map(existingWorkouts.map((w) => [w.name, w]));
		const sessionByDate = new Map(existingSessions.map((s) => [s.date, s]));

		result.totalItems =
			backup.exercises.length +
			backup.workouts.length +
			backup.sessions.length +
			backup.personalRecords.length;

		// Build exercise ID mapping (backup ID -> new Tablinum ID)
		const exerciseIdMap = new Map<string, string>();

		if (signal?.aborted) throw new Error('Import cancelled by user');

		// Import exercises (already deduplicated)
		for (const exercise of deduplicatedExercises) {
			if (signal?.aborted) throw new Error('Import cancelled by user');
			const existing = exerciseByName.get(exercise.name);
			const cleanData = pickExerciseFields(exercise);
			if (existing) {
				result.duplicates.exercises.push(exercise.name);
				exerciseIdMap.set(exercise.id, existing.id);
				if (resolution.exercises === 'skip') {
					result.skippedItems++;
				} else {
					await db.collection('exercises').update(existing.id, cleanData);
					result.replacedItems++;
				}
			} else {
				const newId = await db.collection('exercises').add(cleanData);
				exerciseIdMap.set(exercise.id, newId);
				result.importedItems++;
			}
		}

		if (signal?.aborted) throw new Error('Import cancelled by user');

		// Import workouts (already deduplicated, rewrite exerciseId references)
		for (const workout of deduplicatedWorkouts) {
			if (signal?.aborted) throw new Error('Import cancelled by user');
			const remappedWorkout = {
				...workout,
				exercises: workout.exercises.map((ex) => ({
					...ex,
					exerciseId: exerciseIdMap.get(ex.exerciseId) ?? ex.exerciseId
				}))
			};
			const cleanData = pickWorkoutFields(remappedWorkout);
			const existing = workoutByName.get(workout.name);
			if (existing) {
				result.duplicates.workouts.push(workout.name);
				if (resolution.workouts === 'skip') {
					result.skippedItems++;
				} else {
					await db.collection('workouts').update(existing.id, cleanData);
					result.replacedItems++;
				}
			} else {
				await db.collection('workouts').add(cleanData);
				result.importedItems++;
			}
		}

		if (signal?.aborted) throw new Error('Import cancelled by user');

		// Import sessions (already deduplicated, rewrite exerciseId references)
		for (const rawSession of deduplicatedSessions) {
			if (signal?.aborted) throw new Error('Import cancelled by user');
			const remappedSession = {
				...rawSession,
				exercises: rawSession.exercises.map((ex) => ({
					...ex,
					exerciseId: exerciseIdMap.get(ex.exerciseId) ?? ex.exerciseId
				}))
			};
			const cleanData = pickSessionFields(remappedSession);
			const existing = sessionByDate.get(rawSession.date);
			if (existing) {
				result.duplicates.sessions.push(`Session from ${new Date(rawSession.date).toLocaleDateString()}`);
				if (resolution.sessions === 'skip') {
					result.skippedItems++;
				} else {
					await db.collection('sessions').update(existing.id, cleanData);
					result.replacedItems++;
				}
			} else {
				await db.collection('sessions').add(cleanData);
				result.importedItems++;
			}
		}

		if (signal?.aborted) throw new Error('Import cancelled by user');

		// Recalculate personal records from imported sessions instead of importing
		// backup PRs — sessions get new IDs on import, so backup PR sessionId
		// references would be stale.
		if (signal?.aborted) throw new Error('Import cancelled by user');
		await calculatePersonalRecords();

		// Drop any in-progress session state. Imported sessions get new IDs, so any
		// pre-existing `gym-app-session-*` localStorage entry now points at stale or
		// colliding data and would leave the today page stuck on "Resume."
		if (typeof localStorage !== 'undefined') {
			const stale: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key?.startsWith('gym-app-session-')) stale.push(key);
			}
			for (const key of stale) localStorage.removeItem(key);
		}

		return result;
	} catch (error) {
		result.success = false;
		result.errors.push(error instanceof Error ? error.message : 'Unknown error occurred');
		return result;
	}
}
