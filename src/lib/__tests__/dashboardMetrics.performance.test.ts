import { describe, it, expect, beforeAll } from 'vitest';
import type { Session } from '../types';
import { calculateDashboardMetrics } from '../dashboardMetrics';

describe('Dashboard Metrics Performance', () => {
	let largeSessions: Session[] = [];

	beforeAll(() => {
		largeSessions = Array.from({ length: 1000 }, (_, i) => ({
			id: `session-${i}`,
			workoutId: `workout-${i % 50}`,
			workoutName: `Workout ${i % 50}`,
			exercises: Array.from({ length: 10 }, (_, j) => ({
				exerciseId: `exercise-${j}`,
				exerciseName: `Exercise ${j}`,
				primaryMuscle: ['chest', 'back', 'legs', 'shoulders', 'arms'][j % 5],
				sets: Array.from({ length: 5 }, (_, k) => ({
					reps: 10,
					weight: 100 + k * 10,
					completed: k % 2 === 0
				}))
			})),
			date: new Date(2024, 0, (i % 365) + 1).toISOString(),
			duration: 45 + (i % 30),
			createdAt: new Date(2024, 0, (i % 365) + 1).toISOString()
		}));
	});

	it('should calculate metrics efficiently for large datasets', () => {
		const startTime = performance.now();
		const metrics = calculateDashboardMetrics(largeSessions);
		const endTime = performance.now();

		const executionTime = endTime - startTime;

		console.log(`Performance: Calculate metrics for 1,000 sessions (${executionTime.toFixed(2)}ms)`);

		expect(metrics).toBeDefined();
		expect(metrics.totalSessions).toBe(1000);
		expect(executionTime).toBeLessThan(100);
	});

	it('should maintain acceptable performance with repeated calculations', () => {
		const iterations = 100;
		const startTime = performance.now();

		for (let i = 0; i < iterations; i++) {
			calculateDashboardMetrics(largeSessions);
		}

		const endTime = performance.now();
		const averageTime = (endTime - startTime) / iterations;

		console.log(`Performance: Average time for 100 iterations (${averageTime.toFixed(2)}ms)`);

		expect(averageTime).toBeLessThan(10);
	});
});
