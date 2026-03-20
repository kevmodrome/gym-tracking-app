import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { DEPS } from '$lib/invalidation';
import type { Session, Workout } from '$lib/types';

export const load: PageLoad = async ({ depends }) => {
	depends(DEPS.sessions);
	depends(DEPS.workouts);

	const sessions = await db.collection('sessions').orderBy('date').reverse().get() as Session[];
	const allWorkouts = (await db.collection('workouts').get() as Workout[]).map((w) => ({ id: w.id, name: w.name }));

	return {
		sessions,
		allWorkouts
	};
};
