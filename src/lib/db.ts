import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Exercise } from './types';

export class GymDB extends Dexie {
	exercises!: Table<Exercise>;

	constructor() {
		super('gym-recording-app-db');
		this.version(1).stores({
			exercises: 'id, name, category, primary_muscle, is_custom'
		});
	}
}

export const db = new GymDB();

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
