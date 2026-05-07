import type { Session, PersonalRecord, PRHistory } from './types';
import { db } from './db';

export async function calculatePersonalRecords(): Promise<void> {
	const sessions = (await db.collection('sessions').get() as Session[])
		.filter((s) => s.status === 'completed');
	const exercisePRs: Map<string, Map<number, Omit<PersonalRecord, 'id'>>> = new Map();

	sessions.forEach((session) => {
		(session.exercises as Session['exercises']).forEach((exercise) => {
			if (!exercisePRs.has(exercise.exerciseId)) {
				exercisePRs.set(exercise.exerciseId, new Map());
			}

			const prMap = exercisePRs.get(exercise.exerciseId)!;

			exercise.sets.forEach((set) => {
				if (!set.completed) return;
				if (set.warmup) return;
				// PRs are weight-based; bodyweight sets cannot establish a numeric PR.
				if (typeof set.weight !== 'number' || !Number.isFinite(set.weight)) return;

				const currentPR = prMap.get(set.reps);

				if (!currentPR || set.weight > currentPR.weight) {
					prMap.set(set.reps, {
						exerciseId: exercise.exerciseId,
						exerciseName: exercise.exerciseName,
						reps: set.reps,
						weight: set.weight,
						achievedDate: session.date,
						sessionId: session.id
					});
				}
			});
		});
	});

	// Clear all existing PRs
	const existingPRs = await db.collection('personalRecords').get();
	for (const pr of existingPRs) {
		await db.collection('personalRecords').delete(pr.id);
	}

	// Add all new PRs
	for (const prMap of exercisePRs.values()) {
		for (const pr of prMap.values()) {
			await db.collection('personalRecords').add(pr);
		}
	}
}

export async function getPersonalRecordsForExercise(
	exerciseId: string
): Promise<PersonalRecord[]> {
	const records = await db.collection('personalRecords').where('exerciseId').equals(exerciseId).get();
	return (records as PersonalRecord[]).sort((a, b) => a.reps - b.reps);
}

export async function getAllPersonalRecords(): Promise<PersonalRecord[]> {
	return await db.collection('personalRecords').get() as PersonalRecord[];
}

export async function getPRHistoryForExercise(
	exerciseId: string,
	reps: number
): Promise<PRHistory[]> {
	const sessions = (await db.collection('sessions').get() as Session[])
		.filter((s) => s.status === 'completed');
	const history: PRHistory[] = [];

	sessions.forEach((session) => {
		const exercise = (session.exercises as Session['exercises']).find((e) => e.exerciseId === exerciseId);
		if (!exercise) return;

		exercise.sets.forEach((set) => {
			if (
				set.completed &&
				!set.warmup &&
				set.reps === reps &&
				typeof set.weight === 'number' &&
				Number.isFinite(set.weight)
			) {
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
		if (set.warmup) return;
		if (typeof set.weight !== 'number' || !Number.isFinite(set.weight)) return;

		const existingPR = existingPRs.find((pr) => pr.reps === set.reps);

		if (existingPR) {
			if (set.weight > existingPR.weight) {
				newPRs.push({
					id: existingPR.id,
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
				id: '',
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
