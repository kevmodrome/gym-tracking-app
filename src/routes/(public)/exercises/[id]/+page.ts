import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { getPersonalRecordsForExercise } from '$lib/prUtils';
import { DEPS } from '$lib/invalidation';
import { redirect } from '@sveltejs/kit';
import type { Exercise, Session } from '$lib/types';

export const prerender = false;

export const load: PageLoad = async ({ params, depends }) => {
	depends(DEPS.exercises);
	depends(DEPS.sessions);
	depends(DEPS.personalRecords);

	const exerciseId = params.id;

	let exercise: Exercise;
	try {
		exercise = await db.collection('exercises').get(exerciseId) as Exercise;
	} catch {
		redirect(307, '/exercises');
	}

	const personalRecords = await getPersonalRecordsForExercise(exerciseId);

	const allSessions = await db.collection('sessions').orderBy('date').reverse().get() as Session[];
	const sessions = allSessions.filter((s) => s.exercises.some((e) => e.exerciseId === exerciseId));

	return {
		exercise,
		sessions,
		personalRecords,
		exerciseId
	};
}
