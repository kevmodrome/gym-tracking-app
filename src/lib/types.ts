export type ExerciseCategory = 'compound' | 'isolation' | 'cardio' | 'mobility';

export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full-body';

export interface Exercise {
	id: string;
	name: string;
	category: ExerciseCategory;
	primary_muscle: MuscleGroup;
	secondary_muscles: string[];
	equipment: string;
	is_custom: boolean;
}

export interface ExerciseFilters {
	search: string;
	category?: ExerciseCategory;
	primary_muscle?: MuscleGroup;
}

export interface ExerciseRoutine {
	exerciseId: string;
	exerciseName: string;
	targetSets: number;
	targetReps: number;
	targetWeight: number;
	notes?: string;
}

export interface Workout {
	id: string;
	name: string;
	exercises: ExerciseRoutine[];
	notes?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ExerciseSet {
	reps: number;
	weight: number;
	completed: boolean;
}

export interface SessionExercise {
	exerciseId: string;
	exerciseName: string;
	primaryMuscle: string;
	sets: ExerciseSet[];
}

export interface Session {
	id: string;
	workoutId: string;
	workoutName: string;
	exercises: SessionExercise[];
	date: string;
	duration: number;
	notes?: string;
	createdAt: string;
}

export interface PersonalRecord {
	id: string;
	exerciseId: string;
	exerciseName: string;
	reps: number;
	weight: number;
	achievedDate: string;
	sessionId: string;
}

export interface PRHistory {
	reps: number;
	weight: number;
	achievedDate: string;
	sessionId: string;
}
