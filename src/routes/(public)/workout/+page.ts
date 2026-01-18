import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { DEPS } from '$lib/invalidation';

export const load: PageLoad = async ({ depends }) => {
	depends(DEPS.workouts);

	const workouts = await db.workouts.toArray();

	return { workouts };
};
