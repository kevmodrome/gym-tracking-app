import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { Workout, SessionExercise, Exercise } from '$lib/types';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ url }) => {
	// Generate a unique session ID using timestamp + random string
	const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

	const routineId = url.searchParams.get('routine');
	const fromSessionId = url.searchParams.get('from');

	// If a routine is requested, prefill the session in localStorage so the
	// active session screen picks it up via its existing load logic.
	if (routineId && typeof localStorage !== 'undefined') {
		try {
			const routine = (await db.collection('workouts').get(routineId)) as Workout;
			if (routine && routine.exercises && routine.exercises.length > 0) {
				const allExercises = (await db.collection('exercises').get()) as Exercise[];
				const exerciseById = new Map(allExercises.map((ex) => [ex.id, ex]));

				const sessionExercises: SessionExercise[] = routine.exercises.map((er) => {
					const exercise = exerciseById.get(er.exerciseId);
					const targetSets = Math.max(1, er.targetSets || 1);
					return {
						exerciseId: er.exerciseId,
						exerciseName: er.exerciseName,
						primaryMuscle: exercise?.primary_muscle ?? '',
						sets: Array.from({ length: targetSets }, () => ({
							reps: er.targetReps || 0,
							weight: er.targetWeight || 0,
							completed: false,
							notes: ''
						})),
						notes: er.notes || undefined
					};
				});

				const startTime = Date.now();
				localStorage.setItem(
					`gym-app-session-${sessionId}`,
					JSON.stringify({
						sessionExercises,
						currentExerciseIndex: 0,
						currentSetIndex: 0,
						sessionStartTime: startTime,
						sessionDuration: 0,
						sessionNotes: ''
					})
				);
			}
		} catch (e) {
			console.error('Failed to prefill session from routine:', e);
		}
	}

	// Preserve the existing ?from=<sessionId> behavior by forwarding it
	const target = fromSessionId
		? `/session/${sessionId}?from=${encodeURIComponent(fromSessionId)}`
		: `/session/${sessionId}`;

	redirect(307, target);
};
