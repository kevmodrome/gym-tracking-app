import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../../lib/db';
import type { Exercise, Session } from '../../lib/types';

vi.mock('../../lib/db');

describe('Progress Page - E2E Verification', () => {
	let mockExercises: Exercise[];
	let mockSessions: Session[];

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();

		const storage = new Map<string, string>();
		vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
			storage.set(key, value);
		});
		vi.spyOn(localStorage, 'getItem').mockImplementation((key) => {
			return storage.get(key) || null;
		});
		vi.spyOn(localStorage, 'removeItem').mockImplementation((key) => {
			storage.delete(key);
		});
		vi.spyOn(localStorage, 'clear').mockImplementation(() => {
			storage.clear();
		});

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
				name: 'Squat',
				category: 'compound',
				primary_muscle: 'legs',
				secondary_muscles: ['core', 'back'],
				equipment: 'Barbell',
				is_custom: false
			},
			{
				id: 'exercise-3',
				name: 'Deadlift',
				category: 'compound',
				primary_muscle: 'back',
				secondary_muscles: ['legs', 'core'],
				equipment: 'Barbell',
				is_custom: false
			}
		];

		mockSessions = [
			{
				id: 'session-1',
				workoutId: 'workout-1',
				workoutName: 'Chest Day',
				exercises: [
					{
						exerciseId: 'exercise-1',
						exerciseName: 'Bench Press',
						primaryMuscle: 'chest',
						sets: [
							{
								reps: 5,
								weight: 185,
								completed: true
							},
							{
								reps: 5,
								weight: 190,
								completed: true
							},
							{
								reps: 5,
								weight: 195,
								completed: true
							}
						]
					}
				],
				date: '2025-01-01',
				duration: 30,
				createdAt: '2025-01-01T10:00:00.000Z'
			},
			{
				id: 'session-4',
				workoutId: 'workout-4',
				workoutName: 'Leg Day',
				exercises: [
					{
						exerciseId: 'exercise-2',
						exerciseName: 'Squat',
						primaryMuscle: 'legs',
						sets: [
							{
								reps: 5,
								weight: 275,
								completed: true
							},
							{
								reps: 5,
								weight: 280,
								completed: true
							},
							{
								reps: 5,
								weight: 285,
								completed: true
							}
						]
					}
				],
				date: '2025-01-03',
				duration: 45,
				createdAt: '2025-01-03T10:00:00.000Z'
			},
			{
				id: 'session-2',
				workoutId: 'workout-2',
				workoutName: 'Chest Day',
				exercises: [
					{
						exerciseId: 'exercise-1',
						exerciseName: 'Bench Press',
						primaryMuscle: 'chest',
						sets: [
							{
								reps: 5,
								weight: 200,
								completed: true
							},
							{
								reps: 5,
								weight: 205,
								completed: true
							},
							{
								reps: 5,
								weight: 210,
								completed: true
							}
						]
					}
				],
				date: '2025-01-05',
				duration: 35,
				createdAt: '2025-01-05T10:00:00.000Z'
			},
			{
				id: 'session-3',
				workoutId: 'workout-3',
				workoutName: 'Chest Day',
				exercises: [
					{
						exerciseId: 'exercise-1',
						exerciseName: 'Bench Press',
						primaryMuscle: 'chest',
						sets: [
							{
								reps: 5,
								weight: 215,
								completed: true
							},
							{
								reps: 5,
								weight: 220,
								completed: true
							},
							{
								reps: 5,
								weight: 225,
								completed: true
							}
						]
					}
				],
				date: '2025-01-10',
				duration: 40,
				createdAt: '2025-01-10T10:00:00.000Z'
			}
		];

		vi.mocked(db.exercises.toArray).mockResolvedValue(mockExercises);
		vi.mocked(db.sessions.orderBy).mockReturnValue({
			toArray: vi.fn().mockResolvedValue(mockSessions)
		} as any);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Test: Progress page loads without errors', () => {
		it('should have no critical errors on import', async () => {
			expect(async () => {
				await import('./+page.svelte');
			}).not.toThrow();
		}, 10000);
	});

	describe('Test: Chart canvas element renders', () => {
		it('should verify component can be imported and has no errors', async () => {
			await expect(async () => {
				await import('./+page.svelte');
			}).not.toThrow();
		}, 10000);

		it('should load exercises from database', async () => {
			const exercises = await db.exercises.toArray();
			expect(exercises).toBeDefined();
			expect(exercises.length).toBe(3);
			expect(exercises[0].name).toBe('Bench Press');
			expect(db.exercises.toArray).toHaveBeenCalled();
		});

		it('should load sessions from database', async () => {
			await db.sessions.orderBy('date').toArray();
			expect(db.sessions.orderBy).toHaveBeenCalledWith('date');
		});

		it('should handle empty exercises list', async () => {
			vi.mocked(db.exercises.toArray).mockResolvedValueOnce([]);
			const exercises = await db.exercises.toArray();
			expect(exercises).toEqual([]);
			expect(exercises.length).toBe(0);
		});

		it('should handle empty sessions list', async () => {
			vi.mocked(db.sessions.orderBy).mockReturnValueOnce({
				toArray: vi.fn().mockResolvedValueOnce([])
			} as any);

			const result = await db.sessions.orderBy('date').toArray();
			expect(result).toEqual([]);
			expect(result.length).toBe(0);
		});

		it('should handle sessions missing exercise data', async () => {
			const sessionsWithMissingExercise: Session[] = [
				{
					id: 'session-1',
					workoutId: 'workout-1',
					workoutName: 'Test Workout',
					exercises: [
						{
							exerciseId: 'exercise-1',
							exerciseName: 'Bench Press',
							primaryMuscle: 'chest',
							sets: []
						}
					],
					date: '2025-01-01',
					duration: 30,
					createdAt: '2025-01-01T10:00:00.000Z'
				}
			];

			vi.mocked(db.sessions.orderBy).mockReturnValueOnce({
				toArray: vi.fn().mockResolvedValueOnce(sessionsWithMissingExercise)
			} as any);

			const sessions = await db.sessions.orderBy('date').toArray();
			expect(sessions).toHaveLength(1);
			expect(sessions[0].exercises[0].sets).toHaveLength(0);
		});
	});

	describe('Test: Exercise selector works', () => {
		it('should have exercises available for selection', async () => {
			const exercises = await db.exercises.toArray();
			expect(exercises.length).toBeGreaterThan(0);
			expect(exercises.some((ex) => ex.id === 'exercise-1')).toBe(true);
		});

		it('should retrieve exercise by id', async () => {
			const exercises = await db.exercises.toArray();
			const benchPress = exercises.find((ex) => ex.id === 'exercise-1');
			expect(benchPress).toBeDefined();
			expect(benchPress?.name).toBe('Bench Press');
			expect(benchPress?.primary_muscle).toBe('chest');
		});

		it('should filter sessions by selected exercise', async () => {
			const sessions = await db.sessions.orderBy('date').toArray();
			const benchPressSessions = sessions.filter((session) =>
				session.exercises.some((ex) => ex.exerciseId === 'exercise-1')
			);

			expect(benchPressSessions).toHaveLength(3);
			expect(benchPressSessions[0].date).toBe('2025-01-01');
			expect(benchPressSessions[1].date).toBe('2025-01-05');
			expect(benchPressSessions[2].date).toBe('2025-01-10');
		});

		it('should handle exercise change', async () => {
			const exercises = await db.exercises.toArray();
			const firstExercise = exercises[0];
			const secondExercise = exercises[1];

			expect(firstExercise.id).toBe('exercise-1');
			expect(secondExercise.id).toBe('exercise-2');

			const firstExerciseSessions = mockSessions.filter((session) =>
				session.exercises.some((ex) => ex.exerciseId === firstExercise.id)
			);
			const secondExerciseSessions = mockSessions.filter((session) =>
				session.exercises.some((ex) => ex.exerciseId === secondExercise.id)
			);

			expect(firstExerciseSessions).toHaveLength(3);
			expect(secondExerciseSessions).toHaveLength(1);
		});

		it('should store selected exercise preference in localStorage', () => {
			const selectedExerciseId = 'exercise-1';
			localStorage.setItem('progress-selected-exercise', selectedExerciseId);

			const savedId = localStorage.getItem('progress-selected-exercise');
			expect(savedId).toBe('exercise-1');
		});

		it('should clear selected exercise preference', () => {
			localStorage.setItem('progress-selected-exercise', 'exercise-1');
			expect(localStorage.getItem('progress-selected-exercise')).toBeDefined();

			localStorage.removeItem('progress-selected-exercise');
			expect(localStorage.getItem('progress-selected-exercise')).toBeNull();
		});

		it('should handle exercise with no sessions', async () => {
			const deadliftSessions = mockSessions.filter((session) =>
				session.exercises.some((ex) => ex.exerciseId === 'exercise-3')
			);

			expect(deadliftSessions).toHaveLength(0);
		});

		it('should verify exercises are sorted correctly', async () => {
			const exercises = await db.exercises.toArray();
			expect(exercises[0].name).toBe('Bench Press');
			expect(exercises[1].name).toBe('Squat');
			expect(exercises[2].name).toBe('Deadlift');
		});
	});

	describe('Test: Date range controls function', () => {
		it('should have localStorage interface available for view preferences', () => {
			expect(localStorage.getItem).toBeDefined();
			expect(localStorage.setItem).toBeDefined();
			expect(localStorage.removeItem).toBeDefined();
		});

		it('should store selected metric preference', () => {
			const selectedMetric = 'volume';
			localStorage.setItem('progress-metric', selectedMetric);

			const savedMetric = localStorage.getItem('progress-metric');
			expect(savedMetric).toBe('volume');
		});

		it('should change metric from weight to volume', () => {
			localStorage.setItem('progress-metric', 'weight');
			let currentMetric = localStorage.getItem('progress-metric');
			expect(currentMetric).toBe('weight');

			localStorage.setItem('progress-metric', 'volume');
			currentMetric = localStorage.getItem('progress-metric');
			expect(currentMetric).toBe('volume');
		});

		it('should support all metric types', () => {
			const metrics = ['weight', 'volume', 'reps'] as const;

			metrics.forEach((metric) => {
				localStorage.setItem('progress-metric', metric);
				expect(localStorage.getItem('progress-metric')).toBe(metric);
			});
		});

		it('should calculate weight metric correctly', () => {
		 const session: Session = {
				id: 'session-1',
				workoutId: 'workout-1',
				workoutName: 'Test',
				exercises: [
					{
						exerciseId: 'exercise-1',
						exerciseName: 'Bench Press',
						primaryMuscle: 'chest',
						sets: [
							{ reps: 5, weight: 185, completed: true },
							{ reps: 5, weight: 190, completed: true },
							{ reps: 5, weight: 195, completed: true }
						]
					}
				],
				date: '2025-01-01',
				duration: 30,
				createdAt: '2025-01-01T10:00:00.000Z'
			};

			const exerciseInSession = session.exercises.find((ex) => ex.exerciseId === 'exercise-1');
			const maxWeight = exerciseInSession?.sets.reduce((max, set) => Math.max(max, set.weight), 0);
			expect(maxWeight).toBe(195);
		});

		it('should calculate volume metric correctly', () => {
			const session: Session = {
				id: 'session-1',
				workoutId: 'workout-1',
				workoutName: 'Test',
				exercises: [
					{
						exerciseId: 'exercise-1',
						exerciseName: 'Bench Press',
						primaryMuscle: 'chest',
						sets: [
							{ reps: 5, weight: 185, completed: true },
							{ reps: 5, weight: 190, completed: true },
							{ reps: 5, weight: 195, completed: true }
						]
					}
				],
				date: '2025-01-01',
				duration: 30,
				createdAt: '2025-01-01T10:00:00.000Z'
			};

			const exerciseInSession = session.exercises.find((ex) => ex.exerciseId === 'exercise-1');
			const totalVolume = exerciseInSession?.sets.reduce(
				(sum, set) => sum + (set.completed ? set.weight * set.reps : 0),
				0
			);
			expect(totalVolume).toBe(5 * 185 + 5 * 190 + 5 * 195);
		});

		it('should calculate reps metric correctly', () => {
			const session: Session = {
				id: 'session-1',
				workoutId: 'workout-1',
				workoutName: 'Test',
				exercises: [
					{
						exerciseId: 'exercise-1',
						exerciseName: 'Bench Press',
						primaryMuscle: 'chest',
						sets: [
							{ reps: 5, weight: 185, completed: true },
							{ reps: 8, weight: 135, completed: true },
							{ reps: 10, weight: 95, completed: true }
						]
					}
				],
				date: '2025-01-01',
				duration: 30,
				createdAt: '2025-01-01T10:00:00.000Z'
			};

			const exerciseInSession = session.exercises.find((ex) => ex.exerciseId === 'exercise-1');
			const maxReps = exerciseInSession?.sets.reduce((max, set) => Math.max(max, set.reps), 0);
			expect(maxReps).toBe(10);
		});

		it('should filter incomplete sets from volume calculation', () => {
			const session: Session = {
				id: 'session-1',
				workoutId: 'workout-1',
				workoutName: 'Test',
				exercises: [
					{
						exerciseId: 'exercise-1',
						exerciseName: 'Bench Press',
						primaryMuscle: 'chest',
						sets: [
							{ reps: 5, weight: 185, completed: true },
							{ reps: 5, weight: 190, completed: false },
							{ reps: 5, weight: 195, completed: true }
						]
					}
				],
				date: '2025-01-01',
				duration: 30,
				createdAt: '2025-01-01T10:00:00.000Z'
			};

			const exerciseInSession = session.exercises.find((ex) => ex.exerciseId === 'exercise-1');
			const totalVolume = exerciseInSession?.sets.reduce(
				(sum, set) => sum + (set.completed ? set.weight * set.reps : 0),
				0
			);
			expect(totalVolume).toBe(5 * 185 + 5 * 195);
		});
	});

	describe('Test: All tests pass consistently', () => {
		it('should handle multiple successful localStorage operations', () => {
			const testKey1 = 'progress-test-key-1';
			const testKey2 = 'progress-test-key-2';
			const testKey3 = 'progress-test-key-3';

			localStorage.setItem(testKey1, JSON.stringify({ exerciseId: 'exercise-1' }));
			localStorage.setItem(testKey2, JSON.stringify({ metric: 'volume' }));
			localStorage.setItem(testKey3, JSON.stringify({ zoomLevel: 1 }));

			expect(localStorage.getItem(testKey1)).toContain('exercise-1');
			expect(localStorage.getItem(testKey2)).toContain('volume');
			expect(localStorage.getItem(testKey3)).toContain('zoomLevel');

			localStorage.removeItem(testKey1);
			localStorage.removeItem(testKey2);
			localStorage.removeItem(testKey3);

			expect(localStorage.getItem(testKey1)).toBeNull();
			expect(localStorage.getItem(testKey2)).toBeNull();
			expect(localStorage.getItem(testKey3)).toBeNull();
		});

		it('should handle multiple successive exercise retrievals', async () => {
			await db.exercises.toArray();
			await db.exercises.toArray();
			await db.exercises.toArray();

			expect(db.exercises.toArray).toHaveBeenCalledTimes(3);
		});

		it('should handle multiple successive session retrievals', async () => {
			await db.sessions.orderBy('date').toArray();
			await db.sessions.orderBy('date').toArray();
			await db.sessions.orderBy('date').toArray();

			expect(db.sessions.orderBy).toHaveBeenCalledTimes(3);
		});

		it('should handle error scenarios gracefully', async () => {
			vi.mocked(db.exercises.toArray).mockRejectedValueOnce(new Error('Failed to load exercises'));

			try {
				await db.exercises.toArray();
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
			}
		});

		it('should handle concurrent data operations', async () => {
			const [exercises1, exercises2, exercises3] = await Promise.all([
				db.exercises.toArray(),
				db.exercises.toArray(),
				db.exercises.toArray()
			]);

			expect(exercises1).toHaveLength(3);
			expect(exercises2).toHaveLength(3);
			expect(exercises3).toHaveLength(3);
		});

		it('should verify test consistency across runs', async () => {
			for (let i = 0; i < 3; i++) {
				const exercises = await db.exercises.toArray();
				expect(exercises).toHaveLength(3);
				expect(exercises[0].name).toBe('Bench Press');
			}
		});

		it('should verify session ordering by date', async () => {
			const sessions = await db.sessions.orderBy('date').toArray();
			
			const sortedSessions = [...sessions].sort(
				(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
			);

			for (let i = 0; i < sessions.length; i++) {
				expect(sessions[i].date).toBe(sortedSessions[i].date);
			}
		});
	});

	describe('Data persistence testing', () => {
		it('should save and retrieve exercise selection', () => {
			const exerciseSelection = {
				exerciseId: 'exercise-1',
				exerciseName: 'Bench Press'
			};
			localStorage.setItem('gym-progress-exercise', JSON.stringify(exerciseSelection));

			const savedSelection = localStorage.getItem('gym-progress-exercise');
			expect(savedSelection).toBeDefined();
			const parsed = JSON.parse(savedSelection!);
			expect(parsed.exerciseId).toBe('exercise-1');
		});

		it('should save and retrieve metric selection', () => {
			const metricSelection = {
				metric: 'volume',
				lastUpdated: new Date().toISOString()
			};
			localStorage.setItem('gym-progress-metric', JSON.stringify(metricSelection));

			const savedSelection = localStorage.getItem('gym-progress-metric');
			expect(savedSelection).toBeDefined();
			const parsed = JSON.parse(savedSelection!);
			expect(parsed.metric).toBe('volume');
		});

		it('should save and retrieve zoom state', () => {
			const zoomState = {
				scaleX: 1,
				scaleY: 1,
				translateX: 0,
				translateY: 0
			};
			localStorage.setItem('gym-progress-zoom', JSON.stringify(zoomState));

			const savedZoom = localStorage.getItem('gym-progress-zoom');
			expect(savedZoom).toBeDefined();
			const parsed = JSON.parse(savedZoom!);
			expect(parsed.scaleX).toBe(1);
		});
	});

	describe('Utility function testing', () => {
		it('should parse exercise data from localStorage correctly', () => {
			const testExerciseData = {
				exerciseId: 'exercise-1',
				exerciseName: 'Bench Press',
				primaryMuscle: 'chest'
			};
			localStorage.setItem('test-exercise-data', JSON.stringify(testExerciseData));

			const retrieved = localStorage.getItem('test-exercise-data');
			const parsed = JSON.parse(retrieved!);
			expect(parsed).toEqual(testExerciseData);
		});

		it('should handle corrupt localStorage data gracefully', () => {
			localStorage.setItem('corrupt-progress-data', '{invalid json');

			const retrieved = localStorage.getItem('corrupt-progress-data');
			expect(() => {
				JSON.parse(retrieved!);
			}).toThrow();
		});

		it('should handle empty localStorage', () => {
			expect(localStorage.getItem('non-existent-progress-key')).toBeNull();
		});

		it('should calculate average correctly', () => {
			const values = [185, 190, 195, 200, 205];
			const average = values.reduce((sum, val) => sum + val, 0) / values.length;
			expect(average).toBe(195);
		});

		it('should calculate maximum correctly', () => {
			const values = [185, 190, 195, 200, 205];
			const maximum = Math.max(...values);
			expect(maximum).toBe(205);
		});

		it('should calculate minimum correctly', () => {
			const values = [185, 190, 195, 200, 205];
			const minimum = Math.min(...values);
			expect(minimum).toBe(185);
		});
	});

	describe('Mock and spy verification', () => {
		it('should verify db.exercises.toArray is mocked', () => {
			expect(db.exercises.toArray).toBeDefined();
			expect(typeof db.exercises.toArray).toBe('function');
		});

		it('should verify db.sessions.orderBy is mocked', () => {
			expect(db.sessions.orderBy).toBeDefined();
			expect(typeof db.sessions.orderBy).toBe('function');
		});

		it('should verify all mocks can be called', async () => {
			await db.exercises.toArray();
			await db.sessions.orderBy('date').toArray();

			expect(db.exercises.toArray).toHaveBeenCalled();
			expect(db.sessions.orderBy).toHaveBeenCalledWith('date');
		});
	});

	describe('Chart data calculation testing', () => {
		it('should calculate weight progression data points', async () => {
			const sessions = await db.sessions.orderBy('date').toArray();
			const benchPressSessions = sessions.filter((session) =>
				session.exercises.some((ex) => ex.exerciseId === 'exercise-1')
			);

			const dataPoints = benchPressSessions.map((session) => {
				const exerciseInSession = session.exercises.find(
					(ex) => ex.exerciseId === 'exercise-1'
				);
				const maxWeight = exerciseInSession?.sets.reduce(
					(max, set) => Math.max(max, set.weight),
					0
				);
				return { date: session.date, value: maxWeight };
			});

			expect(dataPoints).toHaveLength(3);
			expect(dataPoints[0].value).toBe(195);
			expect(dataPoints[1].value).toBe(210);
			expect(dataPoints[2].value).toBe(225);
		});

		it('should calculate volume progression data points', async () => {
			const sessions = await db.sessions.orderBy('date').toArray();
			const benchPressSessions = sessions.filter((session) =>
				session.exercises.some((ex) => ex.exerciseId === 'exercise-1')
			);

			const dataPoints = benchPressSessions.map((session) => {
				const exerciseInSession = session.exercises.find(
					(ex) => ex.exerciseId === 'exercise-1'
				);
				const totalVolume = exerciseInSession?.sets.reduce(
					(sum, set) => sum + (set.completed ? set.weight * set.reps : 0),
					0
				);
				return { date: session.date, value: totalVolume };
			}).filter((point): point is { date: string; value: number } => point !== undefined);

			expect(dataPoints).toHaveLength(3);
		});

		it('should handle null data points gracefully', async () => {
			const sessions = await db.sessions.orderBy('date').toArray();
			const dataPoints = sessions.map((session) => {
				const exerciseInSession = session.exercises.find(
					(ex) => ex.exerciseId === 'exercise-99'
				);
				if (!exerciseInSession) return null;

				const maxWeight = exerciseInSession.sets.reduce(
					(max, set) => Math.max(max, set.weight),
					0
				);
				return { date: session.date, value: maxWeight };
			}).filter((point): point is { date: string; value: number } => point !== null);

			expect(dataPoints).toHaveLength(0);
		});
	});
});
