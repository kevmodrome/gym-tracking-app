import { initializeExercises } from '$lib/db';

export const load = async () => {
	await initializeExercises();
};
