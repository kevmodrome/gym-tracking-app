import type { PageLoad } from './$types';
import { db, initializeExercises } from '$lib/db';
import { getPersonalRecordsForExercise } from '$lib/prUtils';
import { DEPS } from '$lib/invalidation';
import type { Exercise, PersonalRecord } from '$lib/types';

export const load: PageLoad = async ({ depends }) => {
	depends(DEPS.exercises);
	depends(DEPS.personalRecords);

	await initializeExercises();
	const exercises = await db.exercises.toArray();

	// Load personal records for all exercises
	const exercisePRs = new Map<string, PersonalRecord[]>();
	for (const exercise of exercises) {
		const prs = await getPersonalRecordsForExercise(exercise.id);
		if (prs.length > 0) {
			exercisePRs.set(exercise.id, prs);
		}
	}

	return {
		exercises,
		exercisePRs: Object.fromEntries(exercisePRs)
	};
};
