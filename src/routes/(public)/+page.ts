import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { DEPS } from '$lib/invalidation';
import type { Session, Exercise } from '$lib/types';

export const load: PageLoad = async ({ depends }) => {
	depends(DEPS.sessions);
	depends(DEPS.exercises);

	const sessions = await db.collection('sessions').orderBy('date').reverse().get() as Session[];
	const allExercises = await db.collection('exercises').get() as Exercise[];

	return {
		sessions,
		allExercises
	};
};
