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
	favorited?: boolean;
	/** Default rest seconds for this exercise. Wired by Task 6. */
	restSeconds?: number;
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

/**
 * Weight value for a set. Either a number (kg/lb depending on user prefs)
 * or the string "BW" for bodyweight. Use {@link volumeWeight} to coerce
 * to a number for math.
 */
export type SetWeight = number | 'BW';

export interface ExerciseSet {
	reps: number;
	weight: SetWeight;
	rpe?: number;
	warmup?: boolean;
	completed: boolean;
	notes?: string;
}

/** Returns the numeric weight to use in volume math. BW counts as 0. */
export function volumeWeight(weight: SetWeight): number {
	if (weight === 'BW') return 0;
	if (typeof weight !== 'number' || !Number.isFinite(weight)) return 0;
	return weight;
}

/** True if the weight is the bodyweight sentinel. */
export function isBodyweight(weight: SetWeight): boolean {
	return weight === 'BW';
}

export interface SessionExercise {
	exerciseId: string;
	exerciseName: string;
	primaryMuscle: string;
	sets: ExerciseSet[];
	notes?: string;
}

export interface Session {
	id: string;
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

export type OnboardingGoal = 'build' | 'lose' | 'general';
export type TrackingDepth = 'basic' | 'standard' | 'full';

export interface UserPreferences {
	id: string;
	weightUnit: WeightUnit;
	distanceUnit: DistanceUnit;
	decimalPlaces: number;
	goal?: OnboardingGoal;
	trackingDepth?: TrackingDepth;
	onboardingComplete?: boolean;
	updatedAt: string;
}

export type FoodSource = 'livs' | 'off' | 'custom';

export interface FoodMacros {
	kcal: number;
	protein: number;
	carbs: number;
	fat: number;
}

export interface FoodServingSize {
	grams: number;
	label: string;
}

export interface Food {
	id: string;
	source: FoodSource;
	externalId?: string;
	barcode?: string;
	name: string;
	brand?: string;
	per100g: FoodMacros;
	servingSize?: FoodServingSize;
	lastUsedAt: string;
	createdAt: string;
}

export interface FoodEntry {
	id: string;
	date: string;          // YYYY-MM-DD, device-local
	loggedAt: string;      // ISO timestamp
	foodId?: string;
	inlineFood?: { name: string; per100g: FoodMacros };
	grams: number;
	macros: FoodMacros;    // snapshot
	note?: string;
}

export interface Weight {
	id: string;
	date: string;          // YYYY-MM-DD, unique
	kg: number;
	loggedAt: string;
}

export interface BodyMetric {
	id: string;
	date: string;          // YYYY-MM-DD
	waistCm?: number;
	bodyFatPct?: number;
	loggedAt: string;
}

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type NutritionGoal = 'cut' | 'maintain' | 'bulk';

export interface NutritionProfile {
	id: string;
	heightCm: number;
	age: number;
	sex: Sex;
	activityLevel: ActivityLevel;
	goal: NutritionGoal;
	proteinPerKg: number;          // default 2.0
	manualOverrides: Partial<FoodMacros>;
	updatedAt: string;
}

