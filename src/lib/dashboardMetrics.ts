import type { Session } from './types';

function toLocalDateString(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export interface DashboardMetrics {
	totalSessions: number;
	totalTrainingTime: number;
	totalVolume: number;
	averageDuration: number;
}

export interface VolumeTrend {
	date: string;
	rawDate: Date;
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
	sessionCount: number;
	volume: number;
}

export interface PeriodAggregate {
	volume: number;
	sessionCount: number;
	startDate: Date;
	endDate: Date;
}

export interface AggregateComparison {
	current: PeriodAggregate;
	previous: PeriodAggregate;
	volumeChange: number;
	volumeChangePercent: number;
	sessionCountChange: number;
	sessionCountChangePercent: number;
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
	return calculateVolumeTrendsByScale(sessions, 'week', dateFilter, customStartDate, customEndDate);
}

export type VolumeScale = 'day' | 'week' | 'month';

export function calculateVolumeTrendsByScale(
	sessions: Session[],
	scale: VolumeScale,
	dateFilter: 'week' | 'month' | 'year' | 'custom',
	customStartDate?: Date,
	customEndDate?: Date
): VolumeTrend[] {
	const now = new Date();

	let startDate: Date;
	let endDate: Date = dateFilter === 'custom' && customEndDate ? customEndDate : now;

	switch (dateFilter) {
		case 'week':
			startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
			break;
		case 'month':
			startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
			break;
		case 'year':
			startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
			break;
		case 'custom':
			startDate = customStartDate || new Date(0);
			break;
		default:
			startDate = new Date(0);
	}

	startDate.setHours(0, 0, 0, 0);
	endDate.setHours(23, 59, 59, 999);

	const filteredSessions = sessions.filter((session) => {
		const sessionDate = new Date(session.date);
		return sessionDate >= startDate && sessionDate <= endDate;
	});

	switch (scale) {
		case 'day':
			return aggregateByDay(filteredSessions, startDate, endDate);
		case 'week':
			return aggregateByWeek(filteredSessions, startDate, endDate);
		case 'month':
			return aggregateByMonth(filteredSessions, startDate, endDate);
	}
}

function calculateSessionVolume(session: Session): number {
	return session.exercises.reduce((exerciseTotal, exercise) => {
		return (
			exerciseTotal +
			exercise.sets.reduce(
				(setTotal, set) => setTotal + (set.completed ? set.reps * set.weight : 0),
				0
			)
		);
	}, 0);
}

function aggregateByDay(sessions: Session[], startDate: Date, endDate: Date): VolumeTrend[] {
	const trends: VolumeTrend[] = [];
	const current = new Date(startDate);

	while (current <= endDate) {
		const dayStart = new Date(current);
		dayStart.setHours(0, 0, 0, 0);
		const dayEnd = new Date(current);
		dayEnd.setHours(23, 59, 59, 999);

		const daySessions = sessions.filter((session) => {
			const sessionDate = new Date(session.date);
			return sessionDate >= dayStart && sessionDate <= dayEnd;
		});

		const volume = daySessions.reduce((total, session) => total + calculateSessionVolume(session), 0);

		trends.push({
			date: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
			rawDate: new Date(dayStart),
			volume,
			sessions: daySessions.length
		});

		current.setDate(current.getDate() + 1);
	}

	return trends;
}

function aggregateByWeek(sessions: Session[], startDate: Date, endDate: Date): VolumeTrend[] {
	const trends: VolumeTrend[] = [];
	const current = new Date(startDate);

	// Align to start of week (Sunday)
	const dayOfWeek = current.getDay();
	current.setDate(current.getDate() - dayOfWeek);
	current.setHours(0, 0, 0, 0);

	while (current <= endDate) {
		const weekStart = new Date(current);
		const weekEnd = new Date(current);
		weekEnd.setDate(weekEnd.getDate() + 6);
		weekEnd.setHours(23, 59, 59, 999);

		const weekSessions = sessions.filter((session) => {
			const sessionDate = new Date(session.date);
			return sessionDate >= weekStart && sessionDate <= weekEnd;
		});

		const volume = weekSessions.reduce((total, session) => total + calculateSessionVolume(session), 0);

		trends.push({
			date: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
			rawDate: new Date(weekStart),
			volume,
			sessions: weekSessions.length
		});

		current.setDate(current.getDate() + 7);
	}

	return trends;
}

function aggregateByMonth(sessions: Session[], startDate: Date, endDate: Date): VolumeTrend[] {
	const trends: VolumeTrend[] = [];
	const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

	while (current <= endDate) {
		const monthStart = new Date(current);
		const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
		monthEnd.setHours(23, 59, 59, 999);

		const monthSessions = sessions.filter((session) => {
			const sessionDate = new Date(session.date);
			return sessionDate >= monthStart && sessionDate <= monthEnd;
		});

		const volume = monthSessions.reduce((total, session) => total + calculateSessionVolume(session), 0);

		trends.push({
			date: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
			rawDate: new Date(monthStart),
			volume,
			sessions: monthSessions.length
		});

		current.setMonth(current.getMonth() + 1);
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
		const dateStr = toLocalDateString(date);
		calendar[dateStr] = 0;
	}

	sessions.forEach((session) => {
		const sessionDate = toLocalDateString(new Date(session.date));
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
	const metrics: Record<string, { sessionCount: number; volume: number }> = {};
	const now = new Date();

	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
		const dateStr = toLocalDateString(date);
		metrics[dateStr] = { sessionCount: 0, volume: 0 };
	}

	sessions.forEach((session) => {
		const sessionDate = toLocalDateString(new Date(session.date));
		if (sessionDate in metrics) {
			metrics[sessionDate].sessionCount++;
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
		.map(([date, { sessionCount, volume }]) => ({ date, sessionCount, volume }))
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

	return {
		volume,
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

	return {
		volume,
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
	const sessionCountChange = current.sessionCount - previous.sessionCount;
	const sessionCountChangePercent =
		previous.sessionCount > 0 ? (sessionCountChange / previous.sessionCount) * 100 : 0;

	return {
		current,
		previous,
		volumeChange,
		volumeChangePercent,
		sessionCountChange,
		sessionCountChangePercent
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
	const sessionCountChange = current.sessionCount - previous.sessionCount;
	const sessionCountChangePercent =
		previous.sessionCount > 0 ? (sessionCountChange / previous.sessionCount) * 100 : 0;

	return {
		current,
		previous,
		volumeChange,
		volumeChangePercent,
		sessionCountChange,
		sessionCountChangePercent
	};
}

/**
 * Calculate linear regression trend line for chart data.
 * Returns null if there are fewer than 2 data points.
 */
export function calculateLinearRegression(
	data: Array<{ date: Date; value: number }>
): Array<{ date: Date; value: number }> | null {
	if (!data || data.length < 2) return null;

	const values = data.map((d) => d.value);
	const n = values.length;
	let sumX = 0,
		sumY = 0,
		sumXY = 0,
		sumX2 = 0;

	for (let i = 0; i < n; i++) {
		sumX += i;
		sumY += values[i];
		sumXY += i * values[i];
		sumX2 += i * i;
	}

	const denominator = n * sumX2 - sumX * sumX;
	if (denominator === 0) return null;

	const slope = (n * sumXY - sumX * sumY) / denominator;
	const intercept = (sumY - slope * sumX) / n;

	return data.map((d, i) => ({
		date: d.date,
		value: slope * i + intercept
	}));
}
