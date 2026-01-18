import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { DEPS } from '$lib/invalidation';
import { redirect } from '@sveltejs/kit';

export const prerender = false;

export const load: PageLoad = async ({ params, depends }) => {
	depends(DEPS.workouts);
	depends(DEPS.exercises);

	const workoutId = params.id;

	const workout = await db.workouts.get(workoutId);
	if (!workout) {
		redirect(307, '/workout');
	}

	const exercises = await db.exercises.toArray();

	return {
		workout,
		exercises,
		workoutId
	};
}
