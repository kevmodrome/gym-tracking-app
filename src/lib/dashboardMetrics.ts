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
	volume?: number;
}

export interface DailyMetrics {
	date: string;
	workoutCount: number;
	volume: number;
}

export interface PeriodAggregate {
	volume: number;
	workoutCount: number;
	sessionCount: number;
	startDate: Date;
	endDate: Date;
}

export interface AggregateComparison {
	current: PeriodAggregate;
	previous: PeriodAggregate;
	volumeChange: number;
	volumeChangePercent: number;
	workoutCountChange: number;
	workoutCountChangePercent: number;
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
		weekStart.setHours(0, 0, 0, 0);
		const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
		weekEnd.setHours(23, 59, 59, 999);

		if (dateFilter === 'custom' && customStartDate && weekEnd < customStartDate) {
			continue;
		}

		const weekSessions = sessions.filter((session) => {
			const sessionDate = new Date(session.date);
			return sessionDate >= weekStart && sessionDate <= weekEnd;
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
		.map(([date, count]) => ({ date, count, volume: 0 }))
		.sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateDailyMetrics(
	sessions: Session[],
	days: number = 30
): DailyMetrics[] {
	const metrics: Record<string, { workoutCount: number; volume: number }> = {};
	const now = new Date();
	
	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
		const dateStr = date.toISOString().split('T')[0];
		metrics[dateStr] = { workoutCount: 0, volume: 0 };
	}

	sessions.forEach((session) => {
		const sessionDate = new Date(session.date).toISOString().split('T')[0];
		if (sessionDate in metrics) {
			metrics[sessionDate].workoutCount++;
			metrics[sessionDate].volume += session.exercises.reduce((exerciseTotal, exercise) => {
				return (
					exerciseTotal +
					exercise.sets.reduce((setTotal, set) => {
						if (!set.completed) return setTotal;
						return setTotal + set.reps * set.weight;
					}, 0)
				);
			}, 0);
		}
	});

	return Object.entries(metrics)
		.map(([date, { workoutCount, volume }]) => ({ date, workoutCount, volume }))
		.sort((a, b) => a.date.localeCompare(b.date));
}

export function getLastWorkoutDate(sessions: Session[]): Date | null {
	if (sessions.length === 0) return null;
	
	const latestSession = sessions.reduce((latest, session) => {
		const sessionDate = new Date(session.date);
		return sessionDate > latest ? sessionDate : latest;
	}, new Date(sessions[0].date));
	
	return latestSession;
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

function getWeekStart(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	const diff = d.getDate() - day;
	d.setDate(diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

function getWeekEnd(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	const diff = d.getDate() - day + 6;
	const weekEnd = new Date(d.setDate(diff));
	weekEnd.setHours(23, 59, 59, 999);
	return weekEnd;
}

function getMonthStart(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
	const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
	d.setHours(23, 59, 59, 999);
	return d;
}

export function calculateWeeklyAggregate(
	sessions: Session[],
	referenceDate: Date = new Date()
): PeriodAggregate {
	const weekStart = getWeekStart(referenceDate);
	const weekEnd = getWeekEnd(referenceDate);

	const weekSessions = sessions.filter((session) => {
		const sessionDate = new Date(session.date);
		return sessionDate >= weekStart && sessionDate <= weekEnd;
	});

	const volume = calculateTotalVolume(weekSessions);
	const uniqueWorkoutIds = new Set(weekSessions.map((session) => session.workoutId));

	return {
		volume,
		workoutCount: uniqueWorkoutIds.size,
		sessionCount: weekSessions.length,
		startDate: weekStart,
		endDate: weekEnd
	};
}

export function calculateMonthlyAggregate(
	sessions: Session[],
	referenceDate: Date = new Date()
): PeriodAggregate {
	const monthStart = getMonthStart(referenceDate);
	const monthEnd = getMonthEnd(referenceDate);

	const monthSessions = sessions.filter((session) => {
		const sessionDate = new Date(session.date);
		return sessionDate >= monthStart && sessionDate <= monthEnd;
	});

	const volume = calculateTotalVolume(monthSessions);
	const uniqueWorkoutIds = new Set(monthSessions.map((session) => session.workoutId));

	return {
		volume,
		workoutCount: uniqueWorkoutIds.size,
		sessionCount: monthSessions.length,
		startDate: monthStart,
		endDate: monthEnd
	};
}

export function calculateWeeklyComparison(
	sessions: Session[]
): AggregateComparison {
	const now = new Date();
	const current = calculateWeeklyAggregate(sessions, now);
	const previousWeekStart = new Date(current.startDate);
	previousWeekStart.setDate(previousWeekStart.getDate() - 7);
	const previousWeekEnd = new Date(current.endDate);
	previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);
	const previous = calculateWeeklyAggregate(sessions, previousWeekStart);

	const volumeChange = current.volume - previous.volume;
	const volumeChangePercent =
		previous.volume > 0 ? (volumeChange / previous.volume) * 100 : 0;
	const workoutCountChange = current.workoutCount - previous.workoutCount;
	const workoutCountChangePercent =
		previous.workoutCount > 0 ? (workoutCountChange / previous.workoutCount) * 100 : 0;

	return {
		current,
		previous,
		volumeChange,
		volumeChangePercent,
		workoutCountChange,
		workoutCountChangePercent
	};
}

export function calculateMonthlyComparison(
	sessions: Session[]
): AggregateComparison {
	const now = new Date();
	const current = calculateMonthlyAggregate(sessions, now);
	const previousMonthStart = new Date(current.startDate);
	previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
	const previousMonthEnd = new Date(current.endDate);
	previousMonthEnd.setMonth(previousMonthEnd.getMonth() - 1);
	const previous = calculateMonthlyAggregate(sessions, previousMonthStart);

	const volumeChange = current.volume - previous.volume;
	const volumeChangePercent =
		previous.volume > 0 ? (volumeChange / previous.volume) * 100 : 0;
	const workoutCountChange = current.workoutCount - previous.workoutCount;
	const workoutCountChangePercent =
		previous.workoutCount > 0 ? (workoutCountChange / previous.workoutCount) * 100 : 0;

	return {
		current,
		previous,
		volumeChange,
		volumeChangePercent,
		workoutCountChange,
		workoutCountChangePercent
	};
}
