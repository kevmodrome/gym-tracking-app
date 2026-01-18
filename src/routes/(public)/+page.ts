import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { DEPS } from '$lib/invalidation';

export const load: PageLoad = async ({ depends }) => {
	depends(DEPS.sessions);
	depends(DEPS.exercises);

	const sessions = await db.sessions.orderBy('date').reverse().toArray();
	const allExercises = await db.exercises.toArray();

	return {
		sessions,
		allExercises
	};
};
