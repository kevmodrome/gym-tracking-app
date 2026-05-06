import type { Session } from './types';
import { volumeWeight } from './types';

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

export function calculateSessionVolume(session: Pick<Session, 'exercises'>): number {
	return session.exercises.reduce((exerciseTotal, exercise) => {
		return (
			exerciseTotal +
			exercise.sets.reduce(
				(setTotal, set) =>
					setTotal +
					(set.completed && !set.warmup ? set.reps * volumeWeight(set.weight) : 0),
				0
			)
		);
	}, 0);
}

export function calculateTotalVolume(sessions: Session[]): number {
	return sessions.reduce((total, session) => total + calculateSessionVolume(session), 0);
}

export function calculateAverageDuration(sessions: Session[]): number {
	if (sessions.length === 0) return 0;
	const totalTime = sessions.reduce((acc, session) => acc + session.duration, 0);
	return totalTime / sessions.length;
}

export type VolumeScale = 'day' | 'week' | 'month';

export function calculateVolumeTrendsForChart(
	sessions: Session[],
	scale: VolumeScale,
	maxPoints: number
): VolumeTrend[] {
	if (sessions.length === 0) return [];

	const now = new Date();
	const earliestSession = sessions.reduce((earliest, session) => {
		const d = new Date(session.date);
		return d < earliest ? d : earliest;
	}, new Date(sessions[0].date));

	let startDate: Date;
	switch (scale) {
		case 'day':
			startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - maxPoints);
			break;
		case 'week':
			startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - maxPoints * 7);
			break;
		case 'month':
			startDate = new Date(now.getFullYear(), now.getMonth() - maxPoints, 1);
			break;
	}

	// Don't go further back than the first session
	if (earliestSession > startDate) {
		startDate = earliestSession;
	}

	startDate.setHours(0, 0, 0, 0);
	const endDate = new Date(now);
	endDate.setHours(23, 59, 59, 999);

	const filteredSessions = sessions.filter((session) => {
		const sessionDate = new Date(session.date);
		return sessionDate >= startDate && sessionDate <= endDate;
	});

	return aggregateByPeriod(filteredSessions, startDate, endDate, scale).slice(-maxPoints);
}

function aggregateByPeriod(
	sessions: Session[],
	startDate: Date,
	endDate: Date,
	scale: VolumeScale
): VolumeTrend[] {
	const trends: VolumeTrend[] = [];
	const current = new Date(startDate);

	// Align cursor to period boundary
	if (scale === 'week') {
		current.setDate(current.getDate() - current.getDay()); // Align to Sunday
	} else if (scale === 'month') {
		current.setDate(1);
	}
	current.setHours(0, 0, 0, 0);

	while (current <= endDate) {
		const periodStart = new Date(current);
		let periodEnd: Date;
		let label: string;

		switch (scale) {
			case 'day':
				periodEnd = new Date(current);
				periodEnd.setHours(23, 59, 59, 999);
				label = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
				current.setDate(current.getDate() + 1);
				break;
			case 'week':
				periodEnd = new Date(current);
				periodEnd.setDate(periodEnd.getDate() + 6);
				periodEnd.setHours(23, 59, 59, 999);
				label = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
				current.setDate(current.getDate() + 7);
				break;
			case 'month':
				periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
				periodEnd.setHours(23, 59, 59, 999);
				label = periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
				current.setMonth(current.getMonth() + 1);
				break;
		}

		const periodSessions = sessions.filter((session) => {
			const sessionDate = new Date(session.date);
			return sessionDate >= periodStart && sessionDate <= periodEnd;
		});

		trends.push({
			date: label,
			rawDate: new Date(periodStart),
			volume: periodSessions.reduce((total, s) => total + calculateSessionVolume(s), 0),
			sessions: periodSessions.length
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
			metrics[sessionDate].volume += calculateSessionVolume(session);
		}
	});

	return Object.entries(metrics)
		.map(([date, { sessionCount, volume }]) => ({ date, sessionCount, volume }))
		.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Count consecutive days with at least one session, starting from today
 * (or yesterday if no session today). Mirrors the streak calc on the Today screen.
 */
export function calculateStreakDays(sessions: Session[], referenceDate: Date = new Date()): number {
	if (sessions.length === 0) return 0;
	const sessionDates = new Set(
		sessions.map((s) => toLocalDateString(new Date(s.date)))
	);
	let streak = 0;
	const cursor = new Date(referenceDate);
	cursor.setHours(0, 0, 0, 0);
	if (!sessionDates.has(toLocalDateString(cursor))) {
		cursor.setDate(cursor.getDate() - 1);
		if (!sessionDates.has(toLocalDateString(cursor))) return 0;
	}
	while (sessionDates.has(toLocalDateString(cursor))) {
		streak++;
		cursor.setDate(cursor.getDate() - 1);
	}
	return streak;
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

function calculatePeriodComparison(
	sessions: Session[],
	period: 'week' | 'month'
): AggregateComparison {
	const now = new Date();
	const aggregateFn = period === 'week' ? calculateWeeklyAggregate : calculateMonthlyAggregate;
	const current = aggregateFn(sessions, now);

	const previousStart = new Date(current.startDate);
	if (period === 'week') {
		previousStart.setDate(previousStart.getDate() - 7);
	} else {
		previousStart.setMonth(previousStart.getMonth() - 1);
	}
	const previous = aggregateFn(sessions, previousStart);

	const volumeChange = current.volume - previous.volume;
	const sessionCountChange = current.sessionCount - previous.sessionCount;

	return {
		current,
		previous,
		volumeChange,
		volumeChangePercent: previous.volume > 0 ? (volumeChange / previous.volume) * 100 : 0,
		sessionCountChange,
		sessionCountChangePercent: previous.sessionCount > 0 ? (sessionCountChange / previous.sessionCount) * 100 : 0
	};
}

export function calculateWeeklyComparison(sessions: Session[]): AggregateComparison {
	return calculatePeriodComparison(sessions, 'week');
}

export function calculateMonthlyComparison(sessions: Session[]): AggregateComparison {
	return calculatePeriodComparison(sessions, 'month');
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
