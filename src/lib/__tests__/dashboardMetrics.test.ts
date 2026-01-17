import { describe, it, expect } from 'vitest';
import type { Session } from '../types';
import {
	calculateTotalVolume,
	calculateUniqueWorkouts,
	calculateAverageDuration,
	calculateDashboardMetrics,
	filterSessionsByDateRange,
	isSessionEmpty,
	getCompletedSessions
} from '../dashboardMetrics';

describe('calculateTotalVolume', () => {
	it('should calculate volume correctly for completed sets', () => {
		const sessions: Session[] = [
			{
				id: '1',
				workoutId: 'w1',
				workoutName: 'Test',
				exercises: [
					{
						exerciseId: 'e1',
						exerciseName: 'Bench',
						primaryMuscle: 'chest',
						sets: [
							{ reps: 10, weight: 100, completed: true },
							{ reps: 8, weight: 120, completed: true }
						]
					}
				],
				date: '2024-01-01',
				duration: 60,
				createdAt: '2024-01-01'
			}
		];

		const volume = calculateTotalVolume(sessions);
		expect(volume).toBe(10 * 100 + 8 * 120);
	});

	it('should only count completed sets', () => {
		const sessions: Session[] = [
			{
				id: '1',
				workoutId: 'w1',
				workoutName: 'Test',
				exercises: [
					{
						exerciseId: 'e1',
						exerciseName: 'Bench',
						primaryMuscle: 'chest',
						sets: [
							{ reps: 10, weight: 100, completed: true },
							{ reps: 8, weight: 120, completed: false }
						]
					}
				],
				date: '2024-01-01',
				duration: 60,
				createdAt: '2024-01-01'
			}
		];

		const volume = calculateTotalVolume(sessions);
		expect(volume).toBe(10 * 100);
	});

	it('should return 0 for empty sessions', () => {
		const volume = calculateTotalVolume([]);
		expect(volume).toBe(0);
	});

	it('should handle zero-weight sets', () => {
		const sessions: Session[] = [
			{
				id: '1',
				workoutId: 'w1',
				workoutName: 'Test',
				exercises: [
					{
						exerciseId: 'e1',
						exerciseName: 'Bench',
						primaryMuscle: 'chest',
						sets: [
							{ reps: 10, weight: 0, completed: true },
							{ reps: 8, weight: 100, completed: true }
						]
					}
				],
				date: '2024-01-01',
				duration: 60,
				createdAt: '2024-01-01'
			}
		];

		const volume = calculateTotalVolume(sessions);
		expect(volume).toBe(0 + 8 * 100);
	});
});

describe('calculateUniqueWorkouts', () => {
	it('should count unique workout IDs', () => {
		const sessions: Session[] = [
			{
				id: '1',
				workoutId: 'w1',
				workoutName: 'Workout A',
				exercises: [],
				date: '2024-01-01',
				duration: 60,
				createdAt: '2024-01-01'
			},
			{
				id: '2',
				workoutId: 'w1',
				workoutName: 'Workout A',
				exercises: [],
				date: '2024-01-02',
				duration: 60,
				createdAt: '2024-01-02'
			},
			{
				id: '3',
				workoutId: 'w2',
				workoutName: 'Workout B',
				exercises: [],
				date: '2024-01-03',
				duration: 45,
				createdAt: '2024-01-03'
			}
		];

		const unique = calculateUniqueWorkouts(sessions);
		expect(unique).toBe(2);
	});

	it('should return 0 for empty sessions', () => {
		const unique = calculateUniqueWorkouts([]);
		expect(unique).toBe(0);
	});
});

describe('calculateAverageDuration', () => {
	it('should calculate average duration', () => {
		const sessions: Session[] = [
			{
				id: '1',
				workoutId: 'w1',
				workoutName: 'Test',
				exercises: [],
				date: '2024-01-01',
				duration: 60,
				createdAt: '2024-01-01'
			},
			{
				id: '2',
				workoutId: 'w1',
				workoutName: 'Test',
				exercises: [],
				date: '2024-01-02',
				duration: 90,
				createdAt: '2024-01-02'
			}
		];

		const avg = calculateAverageDuration(sessions);
		expect(avg).toBe(75);
	});

	it('should return 0 for empty sessions', () => {
		const avg = calculateAverageDuration([]);
		expect(avg).toBe(0);
	});
});

describe('calculateDashboardMetrics', () => {
	it('should calculate all metrics correctly', () => {
		const sessions: Session[] = [
			{
				id: '1',
				workoutId: 'w1',
				workoutName: 'Workout A',
				exercises: [
					{
						exerciseId: 'e1',
						exerciseName: 'Bench',
						primaryMuscle: 'chest',
						sets: [
							{ reps: 10, weight: 100, completed: true },
							{ reps: 8, weight: 120, completed: true }
						]
					}
				],
				date: '2024-01-01',
				duration: 60,
				createdAt: '2024-01-01'
			},
			{
				id: '2',
				workoutId: 'w1',
				workoutName: 'Workout A',
				exercises: [
					{
						exerciseId: 'e1',
						exerciseName: 'Bench',
						primaryMuscle: 'chest',
						sets: [
							{ reps: 10, weight: 105, completed: true }
						]
					}
				],
				date: '2024-01-02',
				duration: 45,
				createdAt: '2024-01-02'
			}
		];

		const metrics = calculateDashboardMetrics(sessions);
		expect(metrics.totalSessions).toBe(2);
		expect(metrics.totalTrainingTime).toBe(105);
		expect(metrics.totalVolume).toBe(10 * 100 + 8 * 120 + 10 * 105);
		expect(metrics.uniqueWorkouts).toBe(1);
		expect(metrics.averageDuration).toBe(52.5);
	});
});

describe('filterSessionsByDateRange', () => {
	it('should filter sessions within date range', () => {
		const sessions: Session[] = [
			{
				id: '1',
				workoutId: 'w1',
				workoutName: 'Test',
				exercises: [],
				date: '2024-01-05T10:00:00Z',
				duration: 60,
				createdAt: '2024-01-05'
			},
			{
				id: '2',
				workoutId: 'w1',
				workoutName: 'Test',
				exercises: [],
				date: '2024-01-10T10:00:00Z',
				duration: 60,
				createdAt: '2024-01-10'
			},
			{
				id: '3',
				workoutId: 'w1',
				workoutName: 'Test',
				exercises: [],
				date: '2024-01-15T10:00:00Z',
				duration: 60,
				createdAt: '2024-01-15'
			}
		];

		const startDate = new Date('2024-01-08');
		const endDate = new Date('2024-01-12');
		const filtered = filterSessionsByDateRange(sessions, startDate, endDate);

		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe('2');
	});
});

describe('isSessionEmpty', () => {
	it('should return true for session with no exercises', () => {
		const session: Session = {
			id: '1',
			workoutId: 'w1',
			workoutName: 'Test',
			exercises: [],
			date: '2024-01-01',
			duration: 0,
			createdAt: '2024-01-01'
		};

		expect(isSessionEmpty(session)).toBe(true);
	});

	it('should return true for session with no completed sets', () => {
		const session: Session = {
			id: '1',
			workoutId: 'w1',
			workoutName: 'Test',
			exercises: [
				{
					exerciseId: 'e1',
					exerciseName: 'Bench',
					primaryMuscle: 'chest',
					sets: [
						{ reps: 10, weight: 100, completed: false },
						{ reps: 8, weight: 120, completed: false }
					]
				}
			],
			date: '2024-01-01',
			duration: 60,
			createdAt: '2024-01-01'
		};

		expect(isSessionEmpty(session)).toBe(true);
	});

	it('should return false for session with completed sets', () => {
		const session: Session = {
			id: '1',
			workoutId: 'w1',
			workoutName: 'Test',
			exercises: [
				{
					exerciseId: 'e1',
					exerciseName: 'Bench',
					primaryMuscle: 'chest',
					sets: [
						{ reps: 10, weight: 100, completed: true },
						{ reps: 8, weight: 120, completed: false }
					]
				}
			],
			date: '2024-01-01',
			duration: 60,
			createdAt: '2024-01-01'
		};

		expect(isSessionEmpty(session)).toBe(false);
	});
});

describe('getCompletedSessions', () => {
	it('should filter out empty sessions', () => {
		const sessions: Session[] = [
			{
				id: '1',
				workoutId: 'w1',
				workoutName: 'Test',
				exercises: [],
				date: '2024-01-01',
				duration: 0,
				createdAt: '2024-01-01'
			},
			{
				id: '2',
				workoutId: 'w1',
				workoutName: 'Test',
				exercises: [
					{
						exerciseId: 'e1',
						exerciseName: 'Bench',
						primaryMuscle: 'chest',
						sets: [
							{ reps: 10, weight: 100, completed: true }
						]
					}
				],
				date: '2024-01-02',
				duration: 60,
				createdAt: '2024-01-02'
			}
		];

		const completed = getCompletedSessions(sessions);
		expect(completed).toHaveLength(1);
		expect(completed[0].id).toBe('2');
	});
});
