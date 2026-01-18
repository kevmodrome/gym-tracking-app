import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { getPersonalRecordsForExercise } from '$lib/prUtils';
import { DEPS } from '$lib/invalidation';
import { redirect } from '@sveltejs/kit';

export const prerender = false;

export const load: PageLoad = async ({ params, depends }) => {
	depends(DEPS.exercises);
	depends(DEPS.sessions);
	depends(DEPS.personalRecords);

	const exerciseId = params.id;

	const exercise = await db.exercises.get(exerciseId);
	if (!exercise) {
		redirect(307, '/exercises');
	}

	const personalRecords = await getPersonalRecordsForExercise(exerciseId);

	const allSessions = await db.sessions.orderBy('date').reverse().toArray();
	const sessions = allSessions.filter((s) => s.exercises.some((e) => e.exerciseId === exerciseId));

	return {
		exercise,
		sessions,
		personalRecords,
		exerciseId
	};
}
