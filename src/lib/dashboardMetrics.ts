import type { Session } from './types';

export interface DashboardMetrics {
	totalSessions: number;
	totalTrainingTime: number;
	totalVolume: number;
	uniqueWorkouts: number;
	averageDuration: number;
}

export interface VolumeTrend {
	date: string;
	volume: number;
	sessions: number;
}

export interface MuscleGroup {
	muscle: string;
	count: number;
}

export interface DailyWorkoutEntry {
	date: string;
	count: number;
}

export function calculateTotalVolume(sessions: Session[]): number {
	return sessions.reduce((total, session) => {
		return (
			total +
			session.exercises.reduce((exerciseTotal, exercise) => {
				return (
					exerciseTotal +
					exercise.sets.reduce((setTotal, set) => {
						if (!set.completed) return setTotal;
						return setTotal + set.reps * set.weight;
					}, 0)
				);
			}, 0)
		);
	}, 0);
}

export function calculateUniqueWorkouts(sessions: Session[]): number {
	const uniqueWorkoutIds = new Set(sessions.map((session) => session.workoutId));
	return uniqueWorkoutIds.size;
}

export function calculateAverageDuration(sessions: Session[]): number {
	if (sessions.length === 0) return 0;
	const totalTime = sessions.reduce((acc, session) => acc + session.duration, 0);
	return totalTime / sessions.length;
}

export function calculateVolumeTrends(
	sessions: Session[],
	dateFilter: 'week' | 'month' | 'year' | 'custom',
	customStartDate?: Date,
	customEndDate?: Date
): VolumeTrend[] {
	const trends: VolumeTrend[] = [];
	const now = new Date();
	
	let startDate: Date;
	let weeks: number;

	switch (dateFilter) {
		case 'week':
			startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
			weeks = 7;
			break;
		case 'month':
			startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
			weeks = 4;
			break;
		case 'year':
			startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
			weeks = 12;
			break;
		case 'custom':
			startDate = customStartDate || new Date(0);
			weeks = 12;
			break;
		default:
			startDate = new Date(0);
			weeks = 4;
	}

	let endDate = dateFilter === 'custom' && customEndDate ? customEndDate : now;
	
	for (let i = weeks - 1; i >= 0; i--) {
		const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i + 1) * 7);
		const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
		
		if (dateFilter === 'custom' && customStartDate && weekEnd < customStartDate) {
			continue;
		}
		
		const weekSessions = sessions.filter((session) => {
			const sessionDate = new Date(session.date);
			return sessionDate >= weekStart && sessionDate < weekEnd;
		});

		const volume = weekSessions.reduce((total, session) => {
			return (
				total +
				session.exercises.reduce((exerciseTotal, exercise) => {
					return (
						exerciseTotal +
						exercise.sets.reduce(
							(setTotal, set) => setTotal + (set.completed ? set.reps * set.weight : 0),
							0
						)
					);
				}, 0)
			);
		}, 0);

		trends.push({
			date: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
			volume,
			sessions: weekSessions.length
		});
	}

	return trends;
}

export function calculateMuscleBreakdown(sessions: Session[]): MuscleGroup[] {
	const breakdown: Record<string, number> = {};

	sessions.forEach((session) => {
		const uniqueMuscles = new Set<string>();
		session.exercises.forEach((exercise) => {
			if (exercise.primaryMuscle) {
				uniqueMuscles.add(exercise.primaryMuscle);
			}
		});
		uniqueMuscles.forEach((muscle) => {
			breakdown[muscle] = (breakdown[muscle] || 0) + 1;
		});
	});

	return Object.entries(breakdown)
		.map(([muscle, count]) => ({ muscle, count }))
		.filter(({ count }) => count > 0)
		.sort((a, b) => b.count - a.count);
}

export function calculateDailyWorkouts(
	sessions: Session[],
	days: number = 30
): DailyWorkoutEntry[] {
	const calendar: Record<string, number> = {};
	const now = new Date();
	
	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
		const dateStr = date.toISOString().split('T')[0];
		calendar[dateStr] = 0;
	}

	sessions.forEach((session) => {
		const sessionDate = new Date(session.date).toISOString().split('T')[0];
		if (sessionDate in calendar) {
			calendar[sessionDate]++;
		}
	});

	return Object.entries(calendar)
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateDashboardMetrics(sessions: Session[]): DashboardMetrics {
	return {
		totalSessions: sessions.length,
		totalTrainingTime: sessions.reduce((acc, session) => acc + session.duration, 0),
		totalVolume: calculateTotalVolume(sessions),
		uniqueWorkouts: calculateUniqueWorkouts(sessions),
		averageDuration: calculateAverageDuration(sessions)
	};
}

export function filterSessionsByDateRange(
	sessions: Session[],
	startDate: Date,
	endDate: Date
): Session[] {
	return sessions.filter((session) => {
		const sessionDate = new Date(session.date);
		return sessionDate >= startDate && sessionDate <= endDate;
	});
}

export function isSessionEmpty(session: Session): boolean {
	if (!session.exercises || session.exercises.length === 0) {
		return true;
	}

	return session.exercises.every((exercise) => {
		if (!exercise.sets || exercise.sets.length === 0) {
			return true;
		}

		return exercise.sets.every((set) => !set.completed);
	});
}

export function getCompletedSessions(sessions: Session[]): Session[] {
	return sessions.filter((session) => !isSessionEmpty(session));
}
