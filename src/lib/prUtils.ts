import type { Session, PersonalRecord, PRHistory } from './types';
import { db } from './db';
import { syncManager } from './syncUtils';

export async function calculatePersonalRecords(): Promise<void> {
	const sessions = await db.sessions.toArray();
	const exercisePRs: Map<string, Map<number, PersonalRecord>> = new Map();

	sessions.forEach((session) => {
		session.exercises.forEach((exercise) => {
			if (!exercisePRs.has(exercise.exerciseId)) {
				exercisePRs.set(exercise.exerciseId, new Map());
			}

			const prMap = exercisePRs.get(exercise.exerciseId)!;

			exercise.sets.forEach((set) => {
				if (!set.completed) return;

				const currentPR = prMap.get(set.reps);

				if (!currentPR || set.weight > currentPR.weight) {
					const pr: PersonalRecord = {
						id: `pr-${exercise.exerciseId}-${set.reps}`,
						exerciseId: exercise.exerciseId,
						exerciseName: exercise.exerciseName,
						reps: set.reps,
						weight: set.weight,
						achievedDate: session.date,
						sessionId: session.id
					};

					prMap.set(set.reps, pr);
				}
			});
		});
	});

	await db.personalRecords.clear();
	const allPRs: PersonalRecord[] = [];
	exercisePRs.forEach((prMap) => {
		prMap.forEach((pr) => {
			allPRs.push(pr);
		});
	});
	await db.personalRecords.bulkPut(allPRs);
	
	allPRs.forEach(async (pr) => {
		await syncManager.addToSyncQueue('personalRecord', pr.id, 'update', pr);
	});
}

export async function getPersonalRecordsForExercise(
	exerciseId: string
): Promise<PersonalRecord[]> {
	return (await db.personalRecords.where('exerciseId').equals(exerciseId).toArray()).sort(
		(a, b) => a.reps - b.reps
	);
}

export async function getAllPersonalRecords(): Promise<PersonalRecord[]> {
	return await db.personalRecords.toArray();
}

export async function getPRHistoryForExercise(
	exerciseId: string,
	reps: number
): Promise<PRHistory[]> {
	const sessions = await db.sessions.toArray();
	const history: PRHistory[] = [];

	sessions.forEach((session) => {
		const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
		if (!exercise) return;

		exercise.sets.forEach((set) => {
			if (set.completed && set.reps === reps) {
				history.push({
					reps: set.reps,
					weight: set.weight,
					achievedDate: session.date,
					sessionId: session.id
				});
			}
		});
	});

	return history.sort(
		(a, b) => new Date(b.achievedDate).getTime() - new Date(a.achievedDate).getTime()
	);
}

export async function checkForNewPRs(
	session: Session,
	exerciseId: string
): Promise<PersonalRecord[]> {
	const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
	if (!exercise) return [];

	const existingPRs = await getPersonalRecordsForExercise(exerciseId);
	const newPRs: PersonalRecord[] = [];

	exercise.sets.forEach((set) => {
		if (!set.completed) return;

		const existingPR = existingPRs.find((pr) => pr.reps === set.reps);

		if (existingPR) {
			if (set.weight > existingPR.weight) {
				newPRs.push({
					id: `pr-${exerciseId}-${set.reps}`,
					exerciseId: exercise.exerciseId,
					exerciseName: exercise.exerciseName,
					reps: set.reps,
					weight: set.weight,
					achievedDate: session.date,
					sessionId: session.id
				});
			}
		} else {
			newPRs.push({
				id: `pr-${exerciseId}-${set.reps}`,
				exerciseId: exercise.exerciseId,
				exerciseName: exercise.exerciseName,
				reps: set.reps,
				weight: set.weight,
				achievedDate: session.date,
				sessionId: session.id
			});
		}
	});

	return newPRs;
}

export function getRepRangeLabel(reps: number): string {
	if (reps === 1) return '1RM';
	if (reps <= 3) return '1-3RM';
	if (reps <= 5) return '5RM';
	if (reps <= 8) return '8RM';
	if (reps <= 10) return '10RM';
	if (reps <= 12) return '12RM';
	return `${reps}RM`;
}
