import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { DEPS } from '$lib/invalidation';

export const load: PageLoad = async ({ depends }) => {
	depends(DEPS.exercises);
	depends(DEPS.personalRecords);

	const exercises = await db.exercises.toArray();
	const allPRs = await db.personalRecords.toArray();

	return {
		exercises,
		allPRs
	};
};
