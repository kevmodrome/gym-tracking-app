import Dexie from 'dexie';
import type { Exercise, Workout, Session, PersonalRecord } from './types';
import { db } from './db';

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
		const exercises = await db.exercises.toArray();
		currentItems += exercises.length;
		totalItems += exercises.length;
		onProgress?.(currentItems, totalItems, 'Loading exercises...');

		onProgress?.(currentItems, totalItems, 'Loading workouts...');
		const workouts = await db.workouts.toArray();
		currentItems += workouts.length;
		totalItems += workouts.length;
		onProgress?.(currentItems, totalItems, 'Loading workouts...');

		onProgress?.(currentItems, totalItems, 'Loading sessions...');
		const sessions = await db.sessions.toArray();
		currentItems += sessions.length;
		totalItems += sessions.length;
		onProgress?.(currentItems, totalItems, 'Loading sessions...');

		onProgress?.(currentItems, totalItems, 'Loading personal records...');
		const personalRecords = await db.personalRecords.toArray();
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

	const existingExerciseIds = new Set((await db.exercises.toCollection().keys()).map(String));
	const existingWorkoutIds = new Set((await db.workouts.toCollection().keys()).map(String));
	const existingSessionIds = new Set((await db.sessions.toCollection().keys()).map(String));
	const existingPRIds = new Set((await db.personalRecords.toCollection().keys()).map(String));

	for (const exercise of backup.exercises) {
		if (existingExerciseIds.has(exercise.id)) {
			duplicates.exercises.push(`${exercise.name} (ID: ${exercise.id})`);
		}
	}

	for (const workout of backup.workouts) {
		if (existingWorkoutIds.has(workout.id)) {
			duplicates.workouts.push(`${workout.name} (ID: ${workout.id})`);
		}
	}

	for (const session of backup.sessions) {
		if (existingSessionIds.has(session.id)) {
			duplicates.sessions.push(`Session from ${new Date(session.date).toLocaleDateString()} (ID: ${session.id})`);
		}
	}

	for (const pr of backup.personalRecords) {
		if (existingPRIds.has(pr.id)) {
			duplicates.personalRecords.push(`${pr.exerciseName} (ID: ${pr.id})`);
		}
	}

	return duplicates;
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

	try {
		const existingExerciseIds = new Set((await db.exercises.toCollection().keys()).map(String));
		const existingWorkoutIds = new Set((await db.workouts.toCollection().keys()).map(String));
		const existingSessionIds = new Set((await db.sessions.toCollection().keys()).map(String));
		const existingPRIds = new Set((await db.personalRecords.toCollection().keys()).map(String));

		result.totalItems =
			backup.exercises.length +
			backup.workouts.length +
			backup.sessions.length +
			backup.personalRecords.length;

		if (signal?.aborted) {
			throw new Error('Import cancelled by user');
		}

		await importExercises(
			backup.exercises,
			existingExerciseIds,
			resolution.exercises,
			result,
			signal
		);

		if (signal?.aborted) {
			throw new Error('Import cancelled by user');
		}

		await importWorkouts(
			backup.workouts,
			existingWorkoutIds,
			resolution.workouts,
			result,
			signal
		);

		if (signal?.aborted) {
			throw new Error('Import cancelled by user');
		}

		await importSessions(
			backup.sessions,
			existingSessionIds,
			resolution.sessions,
			result,
			signal
		);

		if (signal?.aborted) {
			throw new Error('Import cancelled by user');
		}

		await importPersonalRecords(
			backup.personalRecords,
			existingPRIds,
			resolution.personalRecords,
			result,
			signal
		);

		return result;
	} catch (error) {
		result.success = false;
		result.errors.push(error instanceof Error ? error.message : 'Unknown error occurred');
		return result;
	}
}

async function importExercises(
	exercises: Exercise[],
	existingIds: Set<string>,
	resolution: 'replace' | 'skip' | 'merge',
	result: ImportResult,
	signal?: AbortSignal
): Promise<void> {
	const toAdd: Exercise[] = [];
	const toUpdate: Exercise[] = [];

	for (const exercise of exercises) {
		if (signal?.aborted) throw new Error('Import cancelled by user');

		if (existingIds.has(exercise.id)) {
			result.duplicates.exercises.push(exercise.name);
			if (resolution === 'skip') {
				result.skippedItems++;
			} else if (resolution === 'replace') {
				toUpdate.push(exercise);
				result.replacedItems++;
			} else {
				toUpdate.push(exercise);
				result.replacedItems++;
			}
		} else {
			toAdd.push(exercise);
			result.importedItems++;
		}
	}

	if (toAdd.length > 0) {
		await db.exercises.bulkAdd(Dexie.deepClone(toAdd));
	}

	if (resolution !== 'skip' && toUpdate.length > 0) {
		await db.exercises.bulkPut(Dexie.deepClone(toUpdate));
	}
}

async function importWorkouts(
	workouts: Workout[],
	existingIds: Set<string>,
	resolution: 'replace' | 'skip' | 'merge',
	result: ImportResult,
	signal?: AbortSignal
): Promise<void> {
	const toAdd: Workout[] = [];
	const toUpdate: Workout[] = [];

	for (const workout of workouts) {
		if (signal?.aborted) throw new Error('Import cancelled by user');

		if (existingIds.has(workout.id)) {
			result.duplicates.workouts.push(workout.name);
			if (resolution === 'skip') {
				result.skippedItems++;
			} else if (resolution === 'replace') {
				toUpdate.push(workout);
				result.replacedItems++;
			} else {
				toUpdate.push(workout);
				result.replacedItems++;
			}
		} else {
			toAdd.push(workout);
			result.importedItems++;
		}
	}

	if (toAdd.length > 0) {
		await db.workouts.bulkAdd(Dexie.deepClone(toAdd));
	}

	if (resolution !== 'skip' && toUpdate.length > 0) {
		await db.workouts.bulkPut(Dexie.deepClone(toUpdate));
	}
}

// Strip legacy workout fields from old-style backup data
function sanitizeSession(session: Session & { workoutId?: string; workoutName?: string }): Session {
	const { workoutId, workoutName, ...cleanSession } = session;
	return cleanSession;
}

async function importSessions(
	sessions: (Session & { workoutId?: string; workoutName?: string })[],
	existingIds: Set<string>,
	resolution: 'replace' | 'skip' | 'merge',
	result: ImportResult,
	signal?: AbortSignal
): Promise<void> {
	const toAdd: Session[] = [];
	const toUpdate: Session[] = [];

	for (const rawSession of sessions) {
		if (signal?.aborted) throw new Error('Import cancelled by user');

		// Strip legacy workout fields from old backups
		const session = sanitizeSession(rawSession);

		if (existingIds.has(session.id)) {
			result.duplicates.sessions.push(`Session from ${new Date(session.date).toLocaleDateString()}`);
			if (resolution === 'skip') {
				result.skippedItems++;
			} else if (resolution === 'replace') {
				toUpdate.push(session);
				result.replacedItems++;
			} else {
				toUpdate.push(session);
				result.replacedItems++;
			}
		} else {
			toAdd.push(session);
			result.importedItems++;
		}
	}

	if (toAdd.length > 0) {
		await db.sessions.bulkAdd(Dexie.deepClone(toAdd));
	}

	if (resolution !== 'skip' && toUpdate.length > 0) {
		await db.sessions.bulkPut(Dexie.deepClone(toUpdate));
	}
}

async function importPersonalRecords(
	prs: PersonalRecord[],
	existingIds: Set<string>,
	resolution: 'replace' | 'skip' | 'merge',
	result: ImportResult,
	signal?: AbortSignal
): Promise<void> {
	const toAdd: PersonalRecord[] = [];
	const toUpdate: PersonalRecord[] = [];

	for (const pr of prs) {
		if (signal?.aborted) throw new Error('Import cancelled by user');

		if (existingIds.has(pr.id)) {
			result.duplicates.personalRecords.push(pr.exerciseName);
			if (resolution === 'skip') {
				result.skippedItems++;
			} else if (resolution === 'replace') {
				toUpdate.push(pr);
				result.replacedItems++;
			} else {
				const existingPR = await db.personalRecords.get(pr.id);
				if (existingPR && new Date(pr.achievedDate) > new Date(existingPR.achievedDate)) {
					toUpdate.push(pr);
					result.replacedItems++;
				} else {
					result.skippedItems++;
				}
			}
		} else {
			toAdd.push(pr);
			result.importedItems++;
		}
	}

	if (toAdd.length > 0) {
		await db.personalRecords.bulkAdd(Dexie.deepClone(toAdd));
	}

	if (resolution !== 'skip' && toUpdate.length > 0) {
		await db.personalRecords.bulkPut(Dexie.deepClone(toUpdate));
	}
}
