import { invalidate } from '$app/navigation';

export const DEPS = {
	exercises: 'app:exercises',
	workouts: 'app:workouts',
	sessions: 'app:sessions',
	personalRecords: 'app:personalRecords'
} as const;

export async function invalidateExercises() {
	await invalidate(DEPS.exercises);
}

export async function invalidateWorkouts() {
	await invalidate(DEPS.workouts);
}

export async function invalidateSessions() {
	await invalidate(DEPS.sessions);
}

export async function invalidatePersonalRecords() {
	await invalidate(DEPS.personalRecords);
}

// Convenience function to invalidate multiple dependencies at once
export async function invalidateMultiple(...deps: (keyof typeof DEPS)[]) {
	await Promise.all(deps.map((dep) => invalidate(DEPS[dep])));
}

// Invalidate all data dependencies (used after sync)
export async function invalidateAll() {
	await Promise.all([
		invalidate(DEPS.exercises),
		invalidate(DEPS.workouts),
		invalidate(DEPS.sessions),
		invalidate(DEPS.personalRecords)
	]);
}
