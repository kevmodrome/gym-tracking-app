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
	rpe?: number;
	completed: boolean;
	notes?: string;
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

export interface AppSettings {
	defaultRestDuration: number;
	soundEnabled: boolean;
	vibrationEnabled: boolean;
}

export type Theme = 'light' | 'dark' | 'system';

export type WeightUnit = 'kg' | 'lb';

export type DistanceUnit = 'km' | 'miles';

export interface AppPreferences {
	theme: Theme;
	weightUnit: WeightUnit;
	distanceUnit: DistanceUnit;
	decimalPlaces: number;
}

export interface NotificationPreferences {
	workoutReminders: boolean;
	prAchievements: boolean;
	progressUpdates: boolean;
	emailNotifications: boolean;
}

export interface UserProfile {
	id: string;
	name: string;
	email: string;
	createdAt: string;
	status: 'active' | 'inactive' | 'suspended';
}

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncTargetType = 'exercise' | 'workout' | 'session' | 'personalRecord';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncQueueItem {
	id: string;
	targetType: SyncTargetType;
	targetId: string;
	operation: SyncOperation;
	data: unknown;
	timestamp: string;
	retries: number;
	lastRetryTime?: string;
	status: SyncStatus;
	error?: string;
}

export interface SyncResult {
	success: boolean;
	itemsProcessed: number;
	itemsFailed: number;
	itemsSkipped: number;
	duration: number;
	message: string;
}

export interface SyncProgress {
	current: number;
	total: number;
	stage: string;
}
