import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { DEPS } from '$lib/invalidation';

export const load: PageLoad = async ({ depends }) => {
	depends(DEPS.sessions);
	depends(DEPS.workouts);

	const sessions = await db.sessions.orderBy('date').reverse().toArray();
	const allWorkouts = (await db.workouts.toArray()).map((w) => ({ id: w.id, name: w.name }));

	return {
		sessions,
		allWorkouts
	};
};
