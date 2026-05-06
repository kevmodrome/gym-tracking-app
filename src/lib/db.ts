import { field, collection } from 'tablinum';
import type { FieldDef } from 'tablinum';
import { Tablinum } from 'tablinum/svelte';
import type { Invite } from 'tablinum/svelte';
import type { Exercise, Workout, Session, PersonalRecord, UserPreferences, SetWeight } from './types';
import {
	clearAppLocalState,
	clearServiceWorkerState,
	getInviteDbName,
	markPendingReset,
} from './reset';

const INVITE_STORAGE_KEY = 'gym-app-invite';

// Weight is `number | "BW"` (SetWeight). Persisted via json so the schema
// accepts both shapes; runtime parsing happens in app code.
const setWeightField = field.json() as FieldDef<SetWeight>;

const exerciseSetDef = field.object({
	reps: field.number(),
	weight: setWeightField,
	rpe: field.optional(field.number()),
	warmup: field.optional(field.boolean()),
	completed: field.boolean(),
	notes: field.optional(field.string()),
});

const sessionExerciseDef = field.object({
	exerciseId: field.string(),
	exerciseName: field.string(),
	primaryMuscle: field.string(),
	sets: field.array(exerciseSetDef),
	notes: field.optional(field.string()),
});

const exerciseRoutineDef = field.object({
	exerciseId: field.string(),
	exerciseName: field.string(),
	targetSets: field.number(),
	targetReps: field.number(),
	targetWeight: field.number(),
	notes: field.optional(field.string()),
});

const exercisesDef = collection('exercises', {
	name: field.string(),
	category: field.string(),
	primary_muscle: field.string(),
	secondary_muscles: field.array(field.string()),
	equipment: field.string(),
	is_custom: field.boolean(),
	favorited: field.optional(field.boolean()),
}, { indices: ['name', 'category', 'primary_muscle', 'is_custom'] });

const workoutsDef = collection('workouts', {
	name: field.string(),
	exercises: field.array(exerciseRoutineDef),
	notes: field.optional(field.string()),
	createdAt: field.string(),
	updatedAt: field.string(),
}, { indices: ['name', 'createdAt'] });

const sessionsDef = collection('sessions', {
	exercises: field.array(sessionExerciseDef),
	date: field.string(),
	duration: field.number(),
	notes: field.optional(field.string()),
	createdAt: field.string(),
}, { indices: ['date', 'createdAt'] });

const personalRecordsDef = collection('personalRecords', {
	exerciseId: field.string(),
	exerciseName: field.string(),
	reps: field.number(),
	weight: field.number(),
	achievedDate: field.string(),
	sessionId: field.string(),
}, { indices: ['exerciseId', 'reps'] });

const preferencesDef = collection('preferences', {
	weightUnit: field.string(),
	distanceUnit: field.string(),
	decimalPlaces: field.number(),
	updatedAt: field.string(),
});

const foodMacrosDef = field.object({
	kcal: field.number(),
	protein: field.number(),
	carbs: field.number(),
	fat: field.number(),
});

const foodServingDef = field.object({
	grams: field.number(),
	label: field.string(),
});

const foodsDef = collection('foods', {
	source: field.string(),
	externalId: field.optional(field.string()),
	barcode: field.optional(field.string()),
	name: field.string(),
	brand: field.optional(field.string()),
	per100g: foodMacrosDef,
	servingSize: field.optional(foodServingDef),
	lastUsedAt: field.string(),
	createdAt: field.string(),
}, { indices: ['barcode', 'name', 'lastUsedAt'] });

const foodEntriesDef = collection('foodEntries', {
	date: field.string(),
	loggedAt: field.string(),
	foodId: field.optional(field.string()),
	inlineFood: field.optional(field.object({
		name: field.string(),
		per100g: foodMacrosDef,
	})),
	grams: field.number(),
	macros: foodMacrosDef,
	note: field.optional(field.string()),
}, { indices: ['date', 'loggedAt'] });

const weightsDef = collection('weights', {
	date: field.string(),
	kg: field.number(),
	loggedAt: field.string(),
}, { indices: ['date'] });

const nutritionProfileDef = collection('nutritionProfile', {
	heightCm: field.number(),
	age: field.number(),
	sex: field.string(),
	activityLevel: field.string(),
	goal: field.string(),
	proteinPerKg: field.number(),
	manualOverrides: field.object({
		kcal: field.optional(field.number()),
		protein: field.optional(field.number()),
		carbs: field.optional(field.number()),
		fat: field.optional(field.number()),
	}),
	updatedAt: field.string(),
});

const schema = {
	exercises: exercisesDef,
	workouts: workoutsDef,
	sessions: sessionsDef,
	personalRecords: personalRecordsDef,
	preferences: preferencesDef,
	foods: foodsDef,
	foodEntries: foodEntriesDef,
	weights: weightsDef,
	nutritionProfile: nutritionProfileDef,
};

const LEAVE_TIMEOUT_MS = 3000;

function getStoredInvite(): Invite | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(INVITE_STORAGE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Invite;
	} catch {
		return null;
	}
}

export function clearStoredInvite() {
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(INVITE_STORAGE_KEY);
	}
}

export function storeInvite(invite: Invite) {
	localStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify(invite));
}

const storedInvite = getStoredInvite();

export const db = new Tablinum({
	schema,
	relays: storedInvite?.relays ?? ['wss://relay.tablinum.dev/'],
	dbName: storedInvite?.dbName ?? 'gym-recording-app',
	epochKeys: storedInvite?.epochKeys,
});

// Helper: look up an exercise by name from the DB
async function findExerciseByName(name: string): Promise<string | null> {
	const results = await db.collection('exercises').where('name').equals(name).get();
	return results.length > 0 ? results[0].id : null;
}

export async function seedDemoData(): Promise<void> {
	// Look up exercise IDs by name (they were seeded by initializeExercises)
	const exerciseNames = [
		'Bench Press', 'Incline Dumbbell Press', 'Overhead Press',
		'Tricep Pushdowns', 'Deadlift', 'Barbell Row', 'Pull-ups',
		'Bicep Curls', 'Squat', 'Leg Press', 'Walking Lunges'
	];
	const idMap = new Map<string, string>();
	for (const name of exerciseNames) {
		const id = await findExerciseByName(name);
		if (id) idMap.set(name, id);
	}

	// Clear existing demo data
	const allWorkouts = await db.collection('workouts').get();
	for (const w of allWorkouts) {
		if (w.id.startsWith('demo-') || w.name === 'Push Day' || w.name === 'Pull Day' || w.name === 'Leg Day') {
			await db.collection('workouts').delete(w.id);
		}
	}
	const allSessions = await db.collection('sessions').get();
	for (const s of allSessions) {
		if (s.id.startsWith('demo-')) {
			await db.collection('sessions').delete(s.id);
		}
	}

	// Seed workouts
	const workoutData = [
		{
			name: 'Push Day',
			exercises: [
				{ exerciseId: idMap.get('Bench Press') ?? '', exerciseName: 'Bench Press', targetSets: 4, targetReps: 8, targetWeight: 135 },
				{ exerciseId: idMap.get('Incline Dumbbell Press') ?? '', exerciseName: 'Incline Dumbbell Press', targetSets: 3, targetReps: 10, targetWeight: 50 },
				{ exerciseId: idMap.get('Overhead Press') ?? '', exerciseName: 'Overhead Press', targetSets: 3, targetReps: 8, targetWeight: 95 },
				{ exerciseId: idMap.get('Tricep Pushdowns') ?? '', exerciseName: 'Tricep Pushdowns', targetSets: 3, targetReps: 12, targetWeight: 40 },
			],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
		{
			name: 'Pull Day',
			exercises: [
				{ exerciseId: idMap.get('Deadlift') ?? '', exerciseName: 'Deadlift', targetSets: 4, targetReps: 5, targetWeight: 225 },
				{ exerciseId: idMap.get('Barbell Row') ?? '', exerciseName: 'Barbell Row', targetSets: 4, targetReps: 8, targetWeight: 135 },
				{ exerciseId: idMap.get('Pull-ups') ?? '', exerciseName: 'Pull-ups', targetSets: 3, targetReps: 8, targetWeight: 0 },
				{ exerciseId: idMap.get('Bicep Curls') ?? '', exerciseName: 'Bicep Curls', targetSets: 3, targetReps: 12, targetWeight: 30 },
			],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
		{
			name: 'Leg Day',
			exercises: [
				{ exerciseId: idMap.get('Squat') ?? '', exerciseName: 'Squat', targetSets: 4, targetReps: 6, targetWeight: 185 },
				{ exerciseId: idMap.get('Leg Press') ?? '', exerciseName: 'Leg Press', targetSets: 3, targetReps: 10, targetWeight: 270 },
				{ exerciseId: idMap.get('Walking Lunges') ?? '', exerciseName: 'Walking Lunges', targetSets: 3, targetReps: 12, targetWeight: 40 },
			],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
	];

	for (const w of workoutData) {
		await db.collection('workouts').add(w);
	}

	// Seed sessions
	const sessionData = [
		{
			exercises: [
				{
					exerciseId: idMap.get('Bench Press') ?? '',
					exerciseName: 'Bench Press',
					primaryMuscle: 'chest',
					sets: [
						{ reps: 8, weight: 135, completed: true },
						{ reps: 8, weight: 135, completed: true },
						{ reps: 7, weight: 135, completed: true },
						{ reps: 6, weight: 135, completed: true },
					],
				},
				{
					exerciseId: idMap.get('Incline Dumbbell Press') ?? '',
					exerciseName: 'Incline Dumbbell Press',
					primaryMuscle: 'chest',
					sets: [
						{ reps: 10, weight: 50, completed: true },
						{ reps: 10, weight: 50, completed: true },
						{ reps: 8, weight: 50, completed: true },
					],
				},
				{
					exerciseId: idMap.get('Overhead Press') ?? '',
					exerciseName: 'Overhead Press',
					primaryMuscle: 'shoulders',
					sets: [
						{ reps: 8, weight: 95, completed: true },
						{ reps: 8, weight: 95, completed: true },
						{ reps: 6, weight: 95, completed: true },
					],
				},
			],
			date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
			duration: 45,
			createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
		},
		{
			exercises: [
				{
					exerciseId: idMap.get('Deadlift') ?? '',
					exerciseName: 'Deadlift',
					primaryMuscle: 'back',
					sets: [
						{ reps: 5, weight: 225, completed: true },
						{ reps: 5, weight: 225, completed: true },
						{ reps: 5, weight: 225, completed: true },
						{ reps: 4, weight: 225, completed: true },
					],
				},
				{
					exerciseId: idMap.get('Barbell Row') ?? '',
					exerciseName: 'Barbell Row',
					primaryMuscle: 'back',
					sets: [
						{ reps: 8, weight: 135, completed: true },
						{ reps: 8, weight: 135, completed: true },
						{ reps: 8, weight: 135, completed: true },
						{ reps: 7, weight: 135, completed: true },
					],
				},
			],
			date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
			duration: 50,
			createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
		},
	];

	for (const s of sessionData) {
		await db.collection('sessions').add(s);
	}

	console.log('Demo data seeded successfully!');
}

export async function resetAllData(): Promise<void> {
	const dbName = getInviteDbName();
	markPendingReset(dbName);
	clearAppLocalState();
	await clearServiceWorkerState();
	window.location.assign('/');
}

export async function leaveDevice(): Promise<void> {
	const dbName = getInviteDbName();
	markPendingReset(dbName);
	clearAppLocalState();

	const leaveResult = await Promise.race([
		db.leave()
			.then(() => 'completed' as const)
			.catch((error) => {
				console.error('Failed to complete db.leave() during leaveDevice:', error);
				return 'failed' as const;
			}),
		new Promise<'timed_out'>((resolve) => {
			setTimeout(() => resolve('timed_out'), LEAVE_TIMEOUT_MS);
		}),
	]);

	if (leaveResult === 'timed_out') {
		console.warn(
			`db.leave() did not finish within ${LEAVE_TIMEOUT_MS}ms; continuing with deferred cleanup`
		);
	}

	await clearServiceWorkerState();
	window.location.assign('/');
}

const defaultExercises: Omit<Exercise, 'id'>[] = [
	{ name: 'Bench Press', category: 'compound', primary_muscle: 'chest', secondary_muscles: ['triceps', 'shoulders'], equipment: 'Barbell', is_custom: false },
	{ name: 'Incline Dumbbell Press', category: 'compound', primary_muscle: 'chest', secondary_muscles: ['shoulders', 'triceps'], equipment: 'Dumbbells', is_custom: false },
	{ name: 'Chest Fly', category: 'isolation', primary_muscle: 'chest', secondary_muscles: [], equipment: 'Dumbbells or Machine', is_custom: false },
	{ name: 'Push-ups', category: 'compound', primary_muscle: 'chest', secondary_muscles: ['triceps', 'shoulders', 'core'], equipment: 'Bodyweight', is_custom: false },
	{ name: 'Squat', category: 'compound', primary_muscle: 'legs', secondary_muscles: ['core', 'back'], equipment: 'Barbell', is_custom: false },
	{ name: 'Deadlift', category: 'compound', primary_muscle: 'back', secondary_muscles: ['legs', 'core'], equipment: 'Barbell', is_custom: false },
	{ name: 'Pull-ups', category: 'compound', primary_muscle: 'back', secondary_muscles: ['biceps', 'shoulders'], equipment: 'Pull-up Bar', is_custom: false },
	{ name: 'Barbell Row', category: 'compound', primary_muscle: 'back', secondary_muscles: ['biceps', 'shoulders'], equipment: 'Barbell', is_custom: false },
	{ name: 'Lat Pulldown', category: 'compound', primary_muscle: 'back', secondary_muscles: ['biceps'], equipment: 'Cable Machine', is_custom: false },
	{ name: 'Overhead Press', category: 'compound', primary_muscle: 'shoulders', secondary_muscles: ['triceps', 'core'], equipment: 'Barbell or Dumbbells', is_custom: false },
	{ name: 'Lateral Raises', category: 'isolation', primary_muscle: 'shoulders', secondary_muscles: [], equipment: 'Dumbbells', is_custom: false },
	{ name: 'Face Pulls', category: 'isolation', primary_muscle: 'shoulders', secondary_muscles: [], equipment: 'Cable Machine or Band', is_custom: false },
	{ name: 'Bicep Curls', category: 'isolation', primary_muscle: 'arms', secondary_muscles: [], equipment: 'Barbell or Dumbbells', is_custom: false },
	{ name: 'Tricep Pushdowns', category: 'isolation', primary_muscle: 'arms', secondary_muscles: [], equipment: 'Cable Machine', is_custom: false },
	{ name: 'Hammer Curls', category: 'isolation', primary_muscle: 'arms', secondary_muscles: [], equipment: 'Dumbbells', is_custom: false },
	{ name: 'Plank', category: 'isolation', primary_muscle: 'core', secondary_muscles: [], equipment: 'Bodyweight', is_custom: false },
	{ name: 'Russian Twists', category: 'isolation', primary_muscle: 'core', secondary_muscles: [], equipment: 'Bodyweight or Medicine Ball', is_custom: false },
	{ name: 'Running', category: 'cardio', primary_muscle: 'legs', secondary_muscles: ['core'], equipment: 'None or Treadmill', is_custom: false },
	{ name: 'Cycling', category: 'cardio', primary_muscle: 'legs', secondary_muscles: ['core'], equipment: 'Bike or Stationary Bike', is_custom: false },
	{ name: 'Jump Rope', category: 'cardio', primary_muscle: 'legs', secondary_muscles: ['core', 'arms', 'shoulders'], equipment: 'Jump Rope', is_custom: false },
	{ name: 'Hip Flexor Stretch', category: 'mobility', primary_muscle: 'legs', secondary_muscles: ['core'], equipment: 'None', is_custom: false },
	{ name: 'Shoulder Circles', category: 'mobility', primary_muscle: 'shoulders', secondary_muscles: [], equipment: 'None', is_custom: false },
	{ name: 'Cat-Cow Stretch', category: 'mobility', primary_muscle: 'back', secondary_muscles: ['core'], equipment: 'None', is_custom: false },
	{ name: 'Leg Press', category: 'compound', primary_muscle: 'legs', secondary_muscles: ['glutes'], equipment: 'Leg Press Machine', is_custom: false },
	{ name: 'Walking Lunges', category: 'compound', primary_muscle: 'legs', secondary_muscles: ['glutes', 'core'], equipment: 'Bodyweight or Dumbbells', is_custom: false },
];

export async function seedDefaultExercises(): Promise<number> {
	const count = await db.collection('exercises').count();
	if (count > 0) {
		return 0;
	}
	for (const exercise of defaultExercises) {
		await db.collection('exercises').add(exercise);
	}
	return defaultExercises.length;
}

export async function initializeExercises(): Promise<void> {
	// Skip seeding default exercises if this device joined via invite —
	// exercises will arrive via sync from the source device.
	if (typeof localStorage !== 'undefined' && localStorage.getItem('gym-app-joined-via-invite')) {
		return;
	}
	await seedDefaultExercises();
}

const DEDUP_FLAG = 'gym-app-exercises-deduplicated';

export async function deduplicateExercises(): Promise<void> {
	if (typeof localStorage !== 'undefined' && localStorage.getItem(DEDUP_FLAG)) {
		return;
	}

	const allExercises = await db.collection('exercises').get() as Exercise[];

	// Group built-in exercises by name to find duplicates
	const byName = new Map<string, Exercise[]>();
	for (const ex of allExercises) {
		if (ex.is_custom) continue;
		const group = byName.get(ex.name) ?? [];
		group.push(ex);
		byName.set(ex.name, group);
	}

	const duplicateGroups = [...byName.values()].filter((g) => g.length > 1);
	if (duplicateGroups.length === 0) {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(DEDUP_FLAG, 'true');
		}
		return;
	}

	// Load all collections that reference exercises
	const allWorkouts = await db.collection('workouts').get() as Workout[];
	const allSessions = await db.collection('sessions').get() as Session[];
	const allPRs = await db.collection('personalRecords').get() as PersonalRecord[];

	// Count references per exercise ID
	const refCount = new Map<string, number>();
	for (const w of allWorkouts) {
		for (const ex of w.exercises) {
			refCount.set(ex.exerciseId, (refCount.get(ex.exerciseId) ?? 0) + 1);
		}
	}
	for (const s of allSessions) {
		for (const ex of s.exercises) {
			refCount.set(ex.exerciseId, (refCount.get(ex.exerciseId) ?? 0) + 1);
		}
	}
	for (const pr of allPRs) {
		refCount.set(pr.exerciseId, (refCount.get(pr.exerciseId) ?? 0) + 1);
	}

	// For each duplicate group, pick the keeper and build a remap
	const remap = new Map<string, string>();
	for (const group of duplicateGroups) {
		group.sort((a, b) => {
			const refsA = refCount.get(a.id) ?? 0;
			const refsB = refCount.get(b.id) ?? 0;
			if (refsB !== refsA) return refsB - refsA;
			if (a.favorited && !b.favorited) return -1;
			if (!a.favorited && b.favorited) return 1;
			return 0;
		});
		const keeper = group[0];
		for (let i = 1; i < group.length; i++) {
			remap.set(group[i].id, keeper.id);
		}
	}

	// Update workout references
	for (const workout of allWorkouts) {
		let changed = false;
		const updatedExercises = workout.exercises.map((ex) => {
			const newId = remap.get(ex.exerciseId);
			if (newId) {
				changed = true;
				return { ...ex, exerciseId: newId };
			}
			return ex;
		});
		if (changed) {
			await db.collection('workouts').update(workout.id, { exercises: updatedExercises });
		}
	}

	// Update session references
	for (const session of allSessions) {
		let changed = false;
		const updatedExercises = session.exercises.map((ex) => {
			const newId = remap.get(ex.exerciseId);
			if (newId) {
				changed = true;
				return { ...ex, exerciseId: newId };
			}
			return ex;
		});
		if (changed) {
			await db.collection('sessions').update(session.id, { exercises: updatedExercises });
		}
	}

	// Update personal record references, deduplicating by (exerciseId, reps)
	const bestPRByKey = new Map<string, PersonalRecord>();
	const prIdsToDelete = new Set<string>();

	for (const pr of allPRs) {
		const effectiveId = remap.get(pr.exerciseId) ?? pr.exerciseId;
		const key = `${effectiveId}:${pr.reps}`;
		const existing = bestPRByKey.get(key);

		if (existing) {
			if (pr.weight > existing.weight) {
				prIdsToDelete.add(existing.id);
				bestPRByKey.set(key, { ...pr, exerciseId: effectiveId });
			} else {
				prIdsToDelete.add(pr.id);
			}
		} else {
			bestPRByKey.set(key, { ...pr, exerciseId: effectiveId });
		}
	}

	for (const pr of allPRs) {
		if (prIdsToDelete.has(pr.id)) {
			await db.collection('personalRecords').delete(pr.id);
		} else {
			const newId = remap.get(pr.exerciseId);
			if (newId) {
				await db.collection('personalRecords').update(pr.id, { exerciseId: newId });
			}
		}
	}

	// Delete duplicate exercises
	for (const duplicateId of remap.keys()) {
		await db.collection('exercises').delete(duplicateId);
	}

	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(DEDUP_FLAG, 'true');
	}

	console.log(`[Dedup] Removed ${remap.size} duplicate exercises, updated references in workouts/sessions/PRs`);
}
