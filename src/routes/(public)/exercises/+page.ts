import type { PageLoad } from './$types';
import { db, initializeExercises } from '$lib/db';
import { getAllPersonalRecords } from '$lib/prUtils';
import { DEPS } from '$lib/invalidation';
import type { Exercise, PersonalRecord } from '$lib/types';

export const load: PageLoad = async ({ depends }) => {
	depends(DEPS.exercises);
	depends(DEPS.personalRecords);

	await initializeExercises();
	const exercises = await db.collection('exercises').get() as Exercise[];

	// Load all personal records in a single query, then group by exerciseId
	const allPRs = await getAllPersonalRecords();
	const exercisePRs = new Map<string, PersonalRecord[]>();
	for (const pr of allPRs) {
		const list = exercisePRs.get(pr.exerciseId);
		if (list) {
			list.push(pr);
		} else {
			exercisePRs.set(pr.exerciseId, [pr]);
		}
	}
	// Sort each exercise's PRs by reps (matching previous behavior)
	for (const prs of exercisePRs.values()) {
		prs.sort((a, b) => a.reps - b.reps);
	}

	return {
		exercises,
		exercisePRs: Object.fromEntries(exercisePRs)
	};
};
