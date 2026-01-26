import Dexie, { liveQuery } from 'dexie';
import type { Table } from 'dexie';
import type { Exercise, Workout, Session, PersonalRecord, SyncQueueItem } from './types';

export class GymDB extends Dexie {
	exercises!: Table<Exercise>;
	workouts!: Table<Workout>;
	sessions!: Table<Session>;
	personalRecords!: Table<PersonalRecord>;
	syncQueue!: Table<SyncQueueItem>;

	constructor() {
		super('gym-recording-app-db');
		this.version(1).stores({
			exercises: 'id, name, category, primary_muscle, is_custom',
			workouts: 'id, name, createdAt, updatedAt'
		});
		this.version(2).stores({
			sessions: 'id, workoutId, date, createdAt'
		});
		this.version(3).stores({
			personalRecords: 'id, exerciseId, reps, weight, achievedDate'
		});
		this.version(4).stores({
			syncQueue: 'id, targetType, targetId, timestamp, status'
		});
		// v5: Remove workout dependency from sessions, add favorited to exercises
		this.version(5)
			.stores({
				exercises: 'id, name, category, primary_muscle, is_custom, favorited',
				sessions: 'id, date, createdAt' // removed workoutId index
			})
			.upgrade((tx) => {
				// Migrate existing sessions to remove workout references
				return tx
					.table('sessions')
					.toCollection()
					.modify((session) => {
						delete session.workoutId;
						delete session.workoutName;
					});
			});
	}
}

export const db = new GymDB();
export { liveQuery };

export async function seedDemoData(): Promise<void> {
	// Seed sample workouts
	const workouts: Workout[] = [
		{
			id: 'demo-workout-1',
			name: 'Push Day',
			exercises: [
				{ exerciseId: '1', exerciseName: 'Bench Press', targetSets: 4, targetReps: 8, targetWeight: 135 },
				{ exerciseId: '2', exerciseName: 'Incline Dumbbell Press', targetSets: 3, targetReps: 10, targetWeight: 50 },
				{ exerciseId: '10', exerciseName: 'Overhead Press', targetSets: 3, targetReps: 8, targetWeight: 95 },
				{ exerciseId: '14', exerciseName: 'Tricep Pushdowns', targetSets: 3, targetReps: 12, targetWeight: 40 }
			],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: 'demo-workout-2',
			name: 'Pull Day',
			exercises: [
				{ exerciseId: '6', exerciseName: 'Deadlift', targetSets: 4, targetReps: 5, targetWeight: 225 },
				{ exerciseId: '8', exerciseName: 'Barbell Row', targetSets: 4, targetReps: 8, targetWeight: 135 },
				{ exerciseId: '7', exerciseName: 'Pull-ups', targetSets: 3, targetReps: 8, targetWeight: 0 },
				{ exerciseId: '13', exerciseName: 'Bicep Curls', targetSets: 3, targetReps: 12, targetWeight: 30 }
			],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: 'demo-workout-3',
			name: 'Leg Day',
			exercises: [
				{ exerciseId: '5', exerciseName: 'Squat', targetSets: 4, targetReps: 6, targetWeight: 185 },
				{ exerciseId: '24', exerciseName: 'Leg Press', targetSets: 3, targetReps: 10, targetWeight: 270 },
				{ exerciseId: '25', exerciseName: 'Walking Lunges', targetSets: 3, targetReps: 12, targetWeight: 40 }
			],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	];

	// Clear existing demo data
	await db.workouts.where('id').startsWith('demo-').delete();
	await db.sessions.where('id').startsWith('demo-').delete();

	// Add workouts
	await db.workouts.bulkAdd(workouts);

	// Seed sample sessions (past completed sessions)
	const sessions: Session[] = [
		{
			id: 'demo-session-1',
			exercises: [
				{
					exerciseId: '1',
					exerciseName: 'Bench Press',
					primaryMuscle: 'chest',
					sets: [
						{ reps: 8, weight: 135, completed: true },
						{ reps: 8, weight: 135, completed: true },
						{ reps: 7, weight: 135, completed: true },
						{ reps: 6, weight: 135, completed: true }
					]
				},
				{
					exerciseId: '2',
					exerciseName: 'Incline Dumbbell Press',
					primaryMuscle: 'chest',
					sets: [
						{ reps: 10, weight: 50, completed: true },
						{ reps: 10, weight: 50, completed: true },
						{ reps: 8, weight: 50, completed: true }
					]
				},
				{
					exerciseId: '10',
					exerciseName: 'Overhead Press',
					primaryMuscle: 'shoulders',
					sets: [
						{ reps: 8, weight: 95, completed: true },
						{ reps: 8, weight: 95, completed: true },
						{ reps: 6, weight: 95, completed: true }
					]
				}
			],
			date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
			duration: 45,
			createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
		},
		{
			id: 'demo-session-2',
			exercises: [
				{
					exerciseId: '6',
					exerciseName: 'Deadlift',
					primaryMuscle: 'back',
					sets: [
						{ reps: 5, weight: 225, completed: true },
						{ reps: 5, weight: 225, completed: true },
						{ reps: 5, weight: 225, completed: true },
						{ reps: 4, weight: 225, completed: true }
					]
				},
				{
					exerciseId: '8',
					exerciseName: 'Barbell Row',
					primaryMuscle: 'back',
					sets: [
						{ reps: 8, weight: 135, completed: true },
						{ reps: 8, weight: 135, completed: true },
						{ reps: 8, weight: 135, completed: true },
						{ reps: 7, weight: 135, completed: true }
					]
				}
			],
			date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
			duration: 50,
			createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
		}
	];

	await db.sessions.bulkAdd(sessions);

	console.log('Demo data seeded successfully!');
}

export async function initializeExercises(): Promise<void> {
	const count = await db.exercises.count();
	if (count === 0) {
		const initialExercises: Exercise[] = [
			{
				id: '1',
				name: 'Bench Press',
				category: 'compound',
				primary_muscle: 'chest',
				secondary_muscles: ['triceps', 'shoulders'],
				equipment: 'Barbell',
				is_custom: false
			},
			{
				id: '2',
				name: 'Incline Dumbbell Press',
				category: 'compound',
				primary_muscle: 'chest',
				secondary_muscles: ['shoulders', 'triceps'],
				equipment: 'Dumbbells',
				is_custom: false
			},
			{
				id: '3',
				name: 'Chest Fly',
				category: 'isolation',
				primary_muscle: 'chest',
				secondary_muscles: [],
				equipment: 'Dumbbells or Machine',
				is_custom: false
			},
			{
				id: '4',
				name: 'Push-ups',
				category: 'compound',
				primary_muscle: 'chest',
				secondary_muscles: ['triceps', 'shoulders', 'core'],
				equipment: 'Bodyweight',
				is_custom: false
			},
			{
				id: '5',
				name: 'Squat',
				category: 'compound',
				primary_muscle: 'legs',
				secondary_muscles: ['core', 'back'],
				equipment: 'Barbell',
				is_custom: false
			},
			{
				id: '6',
				name: 'Deadlift',
				category: 'compound',
				primary_muscle: 'back',
				secondary_muscles: ['legs', 'core'],
				equipment: 'Barbell',
				is_custom: false
			},
			{
				id: '7',
				name: 'Pull-ups',
				category: 'compound',
				primary_muscle: 'back',
				secondary_muscles: ['biceps', 'shoulders'],
				equipment: 'Pull-up Bar',
				is_custom: false
			},
			{
				id: '8',
				name: 'Barbell Row',
				category: 'compound',
				primary_muscle: 'back',
				secondary_muscles: ['biceps', 'shoulders'],
				equipment: 'Barbell',
				is_custom: false
			},
			{
				id: '9',
				name: 'Lat Pulldown',
				category: 'compound',
				primary_muscle: 'back',
				secondary_muscles: ['biceps'],
				equipment: 'Cable Machine',
				is_custom: false
			},
			{
				id: '10',
				name: 'Overhead Press',
				category: 'compound',
				primary_muscle: 'shoulders',
				secondary_muscles: ['triceps', 'core'],
				equipment: 'Barbell or Dumbbells',
				is_custom: false
			},
			{
				id: '11',
				name: 'Lateral Raises',
				category: 'isolation',
				primary_muscle: 'shoulders',
				secondary_muscles: [],
				equipment: 'Dumbbells',
				is_custom: false
			},
			{
				id: '12',
				name: 'Face Pulls',
				category: 'isolation',
				primary_muscle: 'shoulders',
				secondary_muscles: [],
				equipment: 'Cable Machine or Band',
				is_custom: false
			},
			{
				id: '13',
				name: 'Bicep Curls',
				category: 'isolation',
				primary_muscle: 'arms',
				secondary_muscles: [],
				equipment: 'Barbell or Dumbbells',
				is_custom: false
			},
			{
				id: '14',
				name: 'Tricep Pushdowns',
				category: 'isolation',
				primary_muscle: 'arms',
				secondary_muscles: [],
				equipment: 'Cable Machine',
				is_custom: false
			},
			{
				id: '15',
				name: 'Hammer Curls',
				category: 'isolation',
				primary_muscle: 'arms',
				secondary_muscles: [],
				equipment: 'Dumbbells',
				is_custom: false
			},
			{
				id: '16',
				name: 'Plank',
				category: 'isolation',
				primary_muscle: 'core',
				secondary_muscles: [],
				equipment: 'Bodyweight',
				is_custom: false
			},
			{
				id: '17',
				name: 'Russian Twists',
				category: 'isolation',
				primary_muscle: 'core',
				secondary_muscles: [],
				equipment: 'Bodyweight or Medicine Ball',
				is_custom: false
			},
			{
				id: '18',
				name: 'Running',
				category: 'cardio',
				primary_muscle: 'legs',
				secondary_muscles: ['core'],
				equipment: 'None or Treadmill',
				is_custom: false
			},
			{
				id: '19',
				name: 'Cycling',
				category: 'cardio',
				primary_muscle: 'legs',
				secondary_muscles: ['core'],
				equipment: 'Bike or Stationary Bike',
				is_custom: false
			},
			{
				id: '20',
				name: 'Jump Rope',
				category: 'cardio',
				primary_muscle: 'legs',
				secondary_muscles: ['core', 'arms', 'shoulders'],
				equipment: 'Jump Rope',
				is_custom: false
			},
			{
				id: '21',
				name: 'Hip Flexor Stretch',
				category: 'mobility',
				primary_muscle: 'legs',
				secondary_muscles: ['core'],
				equipment: 'None',
				is_custom: false
			},
			{
				id: '22',
				name: 'Shoulder Circles',
				category: 'mobility',
				primary_muscle: 'shoulders',
				secondary_muscles: [],
				equipment: 'None',
				is_custom: false
			},
			{
				id: '23',
				name: 'Cat-Cow Stretch',
				category: 'mobility',
				primary_muscle: 'back',
				secondary_muscles: ['core'],
				equipment: 'None',
				is_custom: false
			},
			{
				id: '24',
				name: 'Leg Press',
				category: 'compound',
				primary_muscle: 'legs',
				secondary_muscles: ['glutes'],
				equipment: 'Leg Press Machine',
				is_custom: false
			},
			{
				id: '25',
				name: 'Walking Lunges',
				category: 'compound',
				primary_muscle: 'legs',
				secondary_muscles: ['glutes', 'core'],
				equipment: 'Bodyweight or Dumbbells',
				is_custom: false
			}
		];
		await db.exercises.bulkAdd(initialExercises);
	}
}
