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
			duplicates.sessions.push(`${session.workoutName} (ID: ${session.id})`);
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
		await db.exercises.bulkAdd(toAdd);
	}

	if (resolution !== 'skip' && toUpdate.length > 0) {
		await db.exercises.bulkPut(toUpdate);
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
		await db.workouts.bulkAdd(toAdd);
	}

	if (resolution !== 'skip' && toUpdate.length > 0) {
		await db.workouts.bulkPut(toUpdate);
	}
}

async function importSessions(
	sessions: Session[],
	existingIds: Set<string>,
	resolution: 'replace' | 'skip' | 'merge',
	result: ImportResult,
	signal?: AbortSignal
): Promise<void> {
	const toAdd: Session[] = [];
	const toUpdate: Session[] = [];

	for (const session of sessions) {
		if (signal?.aborted) throw new Error('Import cancelled by user');

		if (existingIds.has(session.id)) {
			result.duplicates.sessions.push(session.workoutName);
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
		await db.sessions.bulkAdd(toAdd);
	}

	if (resolution !== 'skip' && toUpdate.length > 0) {
		await db.sessions.bulkPut(toUpdate);
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
		await db.personalRecords.bulkAdd(toAdd);
	}

	if (resolution !== 'skip' && toUpdate.length > 0) {
		await db.personalRecords.bulkPut(toUpdate);
	}
}
