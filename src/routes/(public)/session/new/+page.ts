import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { Workout, Session, SessionExercise, Exercise } from '$lib/types';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ url }) => {
	const routineId = url.searchParams.get('routine');
	const fromSessionId = url.searchParams.get('from');

	let initialExercises: SessionExercise[] = [];

	if (routineId) {
		try {
			const routine = (await db.collection('workouts').get(routineId)) as Workout;
			if (routine?.exercises?.length) {
				const allExercises = (await db.collection('exercises').get()) as Exercise[];
				const exerciseById = new Map(allExercises.map((ex) => [ex.id, ex]));
				initialExercises = routine.exercises.map((er) => {
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
			}
		} catch (e) {
			console.error('Failed to prefill session from routine:', e);
		}
	} else if (fromSessionId) {
		try {
			const prior = (await db.collection('sessions').get(fromSessionId)) as Session;
			if (prior?.exercises?.length) {
				initialExercises = prior.exercises.map((ex) => ({
					exerciseId: ex.exerciseId,
					exerciseName: ex.exerciseName,
					primaryMuscle: ex.primaryMuscle,
					sets: ex.sets.map((s) => ({
						reps: s.reps,
						weight: s.weight,
						completed: false
					})),
					notes: ex.notes
				}));
			}
		} catch (e) {
			console.error('Failed to prefill session from prior session:', e);
		}
	}

	const startTime = new Date().toISOString();
	const newId = await db.collection('sessions').add({
		exercises: initialExercises,
		date: startTime,
		duration: 0,
		notes: undefined,
		createdAt: startTime,
		status: 'in_progress',
		currentExerciseIndex: 0,
		currentSetIndex: 0,
	});

	redirect(307, `/session/${newId}`);
};
