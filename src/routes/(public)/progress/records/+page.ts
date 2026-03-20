import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { DEPS } from '$lib/invalidation';
import type { Exercise, PersonalRecord } from '$lib/types';

export const load: PageLoad = async ({ depends }) => {
	depends(DEPS.exercises);
	depends(DEPS.personalRecords);

	const exercises = await db.collection('exercises').get() as Exercise[];
	const allPRs = await db.collection('personalRecords').get() as PersonalRecord[];

	return {
		exercises,
		allPRs
	};
};
