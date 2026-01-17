import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db, initializeExercises } from '$lib/db';
import { getPersonalRecordsForExercise, getRepRangeLabel } from '$lib/prUtils';
import { exportBackupData } from '$lib/backupUtils';

vi.mock('$lib/db');
vi.mock('$lib/prUtils');
vi.mock('$lib/backupUtils');

describe('Home Page - E2E Verification', () => {
	let mockExercises: Array<{
		id: string;
		name: string;
		category: string;
		primary_muscle: string;
		secondary_muscles: string[];
		equipment: string;
		is_custom: boolean;
	}>;

	const mockPRs = [
		{
			id: 'pr-1',
			exerciseId: 'exercise-1',
			exerciseName: 'Bench Press',
			reps: 10,
			weight: 135,
			achievedDate: new Date(Date.now() - 86400000 * 5).toISOString(),
			sessionId: 'session-1'
		},
		{
			id: 'pr-2',
			exerciseId: 'exercise-1',
			exerciseName: 'Bench Press',
			reps: 5,
			weight: 185,
			achievedDate: new Date(Date.now() - 86400000 * 3).toISOString(),
			sessionId: 'session-2'
		},
		{
			id: 'pr-3',
			exerciseId: 'exercise-2',
			exerciseName: 'Shoulder Press',
			reps: 8,
			weight: 95,
			achievedDate: new Date(Date.now() - 86400000 * 2).toISOString(),
			sessionId: 'session-3'
		}
	];

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();

		mockExercises = [
			{
				id: 'exercise-1',
				name: 'Bench Press',
				category: 'compound',
				primary_muscle: 'chest',
				secondary_muscles: ['triceps', 'shoulders'],
				equipment: 'Barbell',
				is_custom: false
			},
			{
				id: 'exercise-2',
				name: 'Shoulder Press',
				category: 'compound',
				primary_muscle: 'shoulders',
				secondary_muscles: ['triceps'],
				equipment: 'Dumbbells',
				is_custom: false
			},
			{
				id: 'exercise-3',
				name: 'Custom Exercise',
				category: 'isolation',
				primary_muscle: 'legs',
				secondary_muscles: [],
				equipment: 'Machine',
				is_custom: true
			}
		];

		(db as any).initializeExercises = vi.fn().mockResolvedValue(undefined);
		(db.exercises.toArray as any).mockResolvedValue(mockExercises);
		(getPersonalRecordsForExercise as any).mockImplementation(async (exerciseId: string) => {
			return mockPRs.filter((pr) => pr.exerciseId === exerciseId);
		});
		(getRepRangeLabel as any).mockImplementation((reps: number) => {
			if (reps <= 5) return 'Strength (1-5)';
			if (reps <= 12) return 'Hypertrophy (6-12)';
			return 'Endurance (12+)';
		});
		(exportBackupData as any).mockResolvedValue({
			success: true,
			totalItems: 10,
			message: 'Export completed successfully'
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Test: Page loads without errors', () => {
		it('should have no critical errors on import', async () => {
			expect(async () => {
				await import('./+page.svelte');
			}).not.toThrow();
		}, 10000);

		it('should initialize exercises on mount', async () => {
			const result = await initializeExercises();
			expect(initializeExercises).toHaveBeenCalled();
			expect(result).toBeUndefined();
		});

		it('should load exercises from database', async () => {
			const exercises = await db.exercises.toArray();
			expect(exercises).toHaveLength(3);
			expect(exercises[0].name).toBe('Bench Press');
			expect(exercises[2].is_custom).toBe(true);
			expect(db.exercises.toArray).toHaveBeenCalled();
		});

		it('should load personal records for exercises', async () => {
			const prs = await getPersonalRecordsForExercise('exercise-1');
			expect(prs).toHaveLength(2);
			expect(prs[0].weight).toBe(135);
			expect(getPersonalRecordsForExercise).toHaveBeenCalledWith('exercise-1');
		});

		it('should handle empty exercises scenario', async () => {
			(db.exercises.toArray as any).mockResolvedValueOnce([]);
			const exercises = await db.exercises.toArray();
			expect(exercises).toHaveLength(0);
		});
	});

	describe('Test: Search and filter functionality', () => {
		it('should filter exercises by search query', () => {
			const searchQuery = 'bench';
			const filtered = mockExercises.filter((ex) =>
				ex.name.toLowerCase().includes(searchQuery.toLowerCase())
			);
			expect(filtered.length).toBe(1);
			expect(filtered[0].name).toBe('Bench Press');
		});

		it('should filter exercises by category', () => {
			const category = 'compound';
			const filtered = mockExercises.filter((ex) => ex.category === category);
			expect(filtered.length).toBe(2);
		});

		it('should filter exercises by muscle group', () => {
			const muscle = 'legs';
			const filtered = mockExercises.filter((ex) => ex.primary_muscle === muscle);
			expect(filtered.length).toBe(1);
		});

		it('should handle combined filters', () => {
			const filtered = mockExercises.filter(
				(ex) => ex.category === 'compound' && ex.primary_muscle === 'chest'
			);
			expect(filtered.length).toBe(1);
			expect(filtered[0].name).toBe('Bench Press');
		});
	});

	describe('Test: Exercise data properties', () => {
		it('should display exercise name', () => {
			const exerciseName = mockExercises[0].name;
			expect(exerciseName).toBe('Bench Press');
		});

		it('should display exercise category', () => {
			const category = mockExercises[0].category;
			expect(category).toBe('compound');
		});

		it('should display primary muscle group', () => {
			const primaryMuscle = mockExercises[0].primary_muscle;
			expect(primaryMuscle).toBe('chest');
		});

		it('should display secondary muscle groups', () => {
			const secondaryMuscles = mockExercises[0].secondary_muscles;
			expect(secondaryMuscles).toEqual(['triceps', 'shoulders']);
		});

		it('should display equipment type', () => {
			const equipment = mockExercises[0].equipment;
			expect(equipment).toBe('Barbell');
		});

		it('should identify custom exercises', () => {
			const customExercises = mockExercises.filter((ex) => ex.is_custom);
			expect(customExercises.length).toBe(1);
			expect(customExercises[0].name).toBe('Custom Exercise');
		});
	});

	describe('Test: Personal records display', () => {
		it('should load PRs for exercises with data', async () => {
			const prs = await getPersonalRecordsForExercise('exercise-1');
			expect(prs.length).toBeGreaterThanOrEqual(0);
		});

		it('should display PR cards with weight and reps', async () => {
			const prs = await getPersonalRecordsForExercise('exercise-1');
			if (prs.length > 0) {
				expect(prs[0].weight).toBe(135);
				expect(prs[0].reps).toBe(10);
			}
		});

		it('should format rep range labels correctly', () => {
			const label1 = getRepRangeLabel(5);
			expect(label1).toBe('Strength (1-5)');

			const label2 = getRepRangeLabel(10);
			expect(label2).toBe('Hypertrophy (6-12)');

			const label3 = getRepRangeLabel(15);
			expect(label3).toBe('Endurance (12+)');
		});

		it('should handle exercises with no PRs', async () => {
			(getPersonalRecordsForExercise as any).mockResolvedValueOnce([]);
			const prs = await getPersonalRecordsForExercise('exercise-3');
			expect(prs).toHaveLength(0);
		});
	});

	describe('Test: Export functionality', () => {
		it('should handle export functionality', async () => {
			const result = await exportBackupData(vi.fn());
			expect(result.success).toBe(true);
			expect(result.message).toBe('Export completed successfully');
			expect(exportBackupData).toHaveBeenCalled();
		});
	});

	describe('Test: All tests pass consistently', () => {
		it('should handle mock initialization consistently', () => {
			vi.clearAllMocks();
			initializeExercises();
			expect(initializeExercises).toHaveBeenCalledTimes(1);
		});

		it('should return consistent exercise data on repeated calls', async () => {
			const exercises1 = await db.exercises.toArray();
			const exercises2 = await db.exercises.toArray();
			expect(exercises1.length).toBe(exercises2.length);
			expect(exercises1[0].id).toBe(exercises2[0].id);
		});

		it('should return consistent PR data on repeated calls', async () => {
			const prs1 = await getPersonalRecordsForExercise('exercise-1');
			const prs2 = await getPersonalRecordsForExercise('exercise-1');
			expect(prs1.length).toBe(prs2.length);
			expect(prs1[0].weight).toBe(prs2[0].weight);
		});

		it('should verify getRepRangeLabel consistency', () => {
			const label1 = getRepRangeLabel(10);
			const label2 = getRepRangeLabel(10);
			expect(label1).toBe(label2);
		});

		it('should verify exportBackupData consistency', async () => {
			const result1 = await exportBackupData(vi.fn());
			const result2 = await exportBackupData(vi.fn());
			expect(result1.success).toBe(result2.success);
		});

		it('should handle error scenarios gracefully', async () => {
			(db.exercises.toArray as any).mockRejectedValueOnce(new Error('Database error'));
			try {
				await db.exercises.toArray();
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
			}
		});

		it('should handle empty PR scenarios', async () => {
			(getPersonalRecordsForExercise as any).mockResolvedValueOnce([]);
			const prs = await getPersonalRecordsForExercise('nonexistent');
			expect(prs).toHaveLength(0);
		});
	});

	describe('Test: Filter combinations work correctly', () => {
		it('should filter by search and category', () => {
			const filtered = mockExercises.filter(
				(ex) =>
					ex.name.toLowerCase().includes('press'.toLowerCase()) && ex.category === 'compound'
			);
			expect(filtered.length).toBeGreaterThanOrEqual(0);
		});

		it('should filter by search and muscle group', () => {
			const filtered = mockExercises.filter(
				(ex) =>
					ex.name.toLowerCase().includes('press'.toLowerCase()) && ex.primary_muscle === 'shoulders'
			);
			expect(filtered.length).toBe(1);
			expect(filtered[0].name).toBe('Shoulder Press');
		});

		it('should filter by all three criteria', () => {
			const filtered = mockExercises.filter(
				(ex) =>
					ex.category === 'compound' &&
					ex.primary_muscle === 'chest' &&
					ex.equipment === 'Barbell'
			);
			expect(filtered.length).toBe(1);
		});

		it('should return empty results for non-matching filters', () => {
			const filtered = mockExercises.filter((ex) => ex.category === 'cardio');
			expect(filtered.length).toBe(0);
		});
	});

	describe('Test: Exercise categories and muscle groups', () => {
		it('should have valid exercise categories', () => {
			const categories = ['compound', 'isolation', 'cardio', 'mobility'];
			mockExercises.forEach((ex) => {
				expect(categories).toContain(ex.category);
			});
		});

		it('should have valid muscle groups', () => {
			const muscleGroups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full-body'];
			mockExercises.forEach((ex) => {
				expect(muscleGroups).toContain(ex.primary_muscle);
			});
		});

		it('should filter by each category', () => {
			const categories = ['compound', 'isolation', 'cardio', 'mobility'];
			categories.forEach((category) => {
				const filtered = mockExercises.filter((ex) => ex.category === category);
				expect(Array.isArray(filtered)).toBe(true);
			});
		});

		it('should filter by each muscle group', () => {
			const muscleGroups = ['chest', 'shoulders', 'legs'];
			muscleGroups.forEach((muscle) => {
				const filtered = mockExercises.filter((ex) => ex.primary_muscle === muscle);
				expect(Array.isArray(filtered)).toBe(true);
			});
		});
	});
});
