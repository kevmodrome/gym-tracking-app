<script lang="ts">
	import { onMount } from 'svelte';
	import { db, liveQuery } from '$lib/db';
	import type { Session, Exercise } from '$lib/types';
		import {
			filterSessionsByDateRange,
			calculateDashboardMetrics,
			calculateVolumeTrends,
			calculateMuscleBreakdown,
			calculateDailyWorkouts,
			calculateDailyMetrics,
			getLastWorkoutDate,
			calculateWeeklyComparison,
			calculateMonthlyComparison
		} from '$lib/dashboardMetrics';

	let sessions = $state<Session[]>([]);
	let allExercises = $state<Exercise[]>([]);
	let dateFilter = $state<'week' | 'month' | 'year' | 'custom'>('month');
	let customStartDate = $state('');
	let customEndDate = $state('');
	let selectedPeriod = $state<'week' | 'month'>('week');

	onMount(async () => {
		allExercises = await db.exercises.toArray();
		
		liveQuery(() => db.sessions.orderBy('date').reverse().toArray()).subscribe((data) => {
			sessions = data;
		});
	});

	const filteredSessions = $derived.by(() => {
		if (sessions.length === 0) return [];
		
		const now = new Date();
		let startDate: Date;

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
				startDate = customStartDate ? new Date(customStartDate) : new Date(0);
				break;
			default:
				startDate = new Date(0);
		}

		let endDate = dateFilter === 'custom' && customEndDate ? new Date(customEndDate) : now;
		
		return filterSessionsByDateRange(sessions, startDate, endDate);
	});

	const metrics = $derived.by(() => calculateDashboardMetrics(filteredSessions));

	const totalSessions = $derived(metrics.totalSessions);
	const totalTrainingTime = $derived(metrics.totalTrainingTime);
	const totalVolume = $derived(metrics.totalVolume);
	const uniqueWorkouts = $derived(metrics.uniqueWorkouts);
	const averageDuration = $derived(metrics.averageDuration);

	const workoutCalendar = $derived.by(() => {
		return calculateDailyWorkouts(filteredSessions, 30);
	});

	const dailyMetrics = $derived.by(() => {
		return calculateDailyMetrics(filteredSessions, 30);
	});

	const lastWorkoutDate = $derived.by(() => getLastWorkoutDate(sessions));

	const muscleGroupBreakdown = $derived.by(() => {
		return calculateMuscleBreakdown(filteredSessions);
	});

	const volumeTrends = $derived.by(() => {
		const startDate = customStartDate ? new Date(customStartDate) : undefined;
		const endDate = customEndDate ? new Date(customEndDate) : undefined;
		return calculateVolumeTrends(filteredSessions, dateFilter, startDate, endDate);
	});

	const weeklyComparison = $derived.by(() => calculateWeeklyComparison(sessions));
	const monthlyComparison = $derived.by(() => calculateMonthlyComparison(sessions));

	function formatTime(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0) {
			return `${hours}h ${mins}m`;
		}
		return `${mins}m`;
	}

	function formatVolume(lbs: number): string {
		if (lbs >= 1000) {
			return (lbs / 1000).toFixed(1) + 'k';
		}
		return lbs.toString();
	}

	function formatDateRange(start: Date, end: Date): string {
		const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
		const startStr = start.toLocaleDateString('en-US', options);
		const endStr = end.toLocaleDateString('en-US', options);
		return `${startStr} - ${endStr}`;
	}

	function getCalendarColor(count: number): string {
		if (count === 0) return 'bg-gray-100';
		if (count === 1) return 'bg-green-200';
		if (count === 2) return 'bg-green-400';
		return 'bg-green-600';
	}

	function isLastWorkoutDate(dateStr: string): boolean {
		if (!lastWorkoutDate) return false;
		const lastDateStr = lastWorkoutDate.toISOString().split('T')[0];
		return dateStr === lastDateStr;
	}

	const pieChartData = $derived.by(() => {
		const total = muscleGroupBreakdown.reduce((acc, item) => acc + item.count, 0);
		let currentAngle = 0;
		
		return muscleGroupBreakdown.map(({ muscle, count }) => {
			const percentage = (count / total) * 100;
			const angle = (percentage / 100) * 360;
			const segment = {
				muscle,
				count,
				percentage,
				startAngle: currentAngle,
				endAngle: currentAngle + angle
			};
			currentAngle += angle;
			return segment;
		});
	});
</script>

<div class="min-h-screen bg-gray-100 p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-7xl mx-auto w-full">
		{#if sessions.length === 0}
			<div class="bg-white rounded-lg shadow-md p-6 sm:p-8 mb-4 sm:mb-6 text-center">
				<div class="w-20 h-20 sm:w-24 sm:h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<span class="text-4xl sm:text-5xl">🏋️</span>
				</div>
				<h1 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Welcome to Your Gym Dashboard!</h1>
				<p class="text-gray-600 mb-4">Start tracking your workouts to see your daily metrics, volume trends, and progress over time.</p>
				<a
					href="/"
					class="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium min-h-[44px]"
				>
					Start Your First Workout
				</a>
			</div>
		{:else}
			<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 sm:mb-6">
				<div class="flex items-center gap-4">
				<a
					href="/"
					class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
				>
					← Back
				</a>
				<h1 class="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Analytics</h1>
			</div>
			<a
				href="/pr"
				class="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm sm:text-base min-h-[44px]"
			>
				🏆 PRs
			</a>
			<div class="flex gap-1 sm:gap-2 overflow-x-auto pb-1 lg:pb-0">
				<button
					onclick={() => (dateFilter = 'week')}
					class:active={dateFilter === 'week'}
					class="px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm {dateFilter === 'week'
						? 'bg-blue-600 text-white'
						: 'bg-white text-gray-700 hover:bg-gray-50'} min-h-[44px]"
					type="button"
				>
					Week
				</button>
				<button
					onclick={() => (dateFilter = 'month')}
					class:active={dateFilter === 'month'}
					class="px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm {dateFilter === 'month'
						? 'bg-blue-600 text-white'
						: 'bg-white text-gray-700 hover:bg-gray-50'} min-h-[44px]"
					type="button"
				>
					Month
				</button>
				<button
					onclick={() => (dateFilter = 'year')}
					class:active={dateFilter === 'year'}
					class="px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm {dateFilter === 'year'
						? 'bg-blue-600 text-white'
						: 'bg-white text-gray-700 hover:bg-gray-50'} min-h-[44px]"
					type="button"
				>
					Year
				</button>
				<button
					onclick={() => (dateFilter = 'custom')}
					class:active={dateFilter === 'custom'}
					class="px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm {dateFilter === 'custom'
						? 'bg-blue-600 text-white'
						: 'bg-white text-gray-700 hover:bg-gray-50'} min-h-[44px]"
					type="button"
				>
					Custom
				</button>
			</div>
		</div>

		{#if dateFilter === 'custom'}
			<div class="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4 sm:mb-6">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
					<div>
						<label for="start-date" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
							Start Date
						</label>
						<input
							id="start-date"
							type="date"
							bind:value={customStartDate}
							class="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px]"
						/>
					</div>
					<div>
						<label for="end-date" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
							End Date
						</label>
						<input
							id="end-date"
							type="date"
							bind:value={customEndDate}
							class="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px]"
						/>
					</div>
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
			<div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs sm:text-sm font-medium text-gray-500">Sessions</p>
						<p class="text-2xl sm:text-3xl font-bold text-gray-900">{totalSessions}</p>
					</div>
					<div class="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center">
						<span class="text-xl sm:text-2xl">📊</span>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs sm:text-sm font-medium text-gray-500">Time</p>
						<p class="text-2xl sm:text-3xl font-bold text-gray-900">{formatTime(totalTrainingTime)}</p>
					</div>
					<div class="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center">
						<span class="text-xl sm:text-2xl">⏱️</span>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs sm:text-sm font-medium text-gray-500">Volume</p>
						<p class="text-xl sm:text-3xl font-bold text-gray-900">{formatVolume(totalVolume)} lbs</p>
					</div>
					<div class="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center">
						<span class="text-xl sm:text-2xl">🏋️</span>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs sm:text-sm font-medium text-gray-500">Avg Duration</p>
						<p class="text-2xl sm:text-3xl font-bold text-gray-900">
							{totalSessions > 0 ? formatTime(totalTrainingTime / totalSessions) : '0m'}
						</p>
					</div>
					<div class="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center">
						<span class="text-xl sm:text-2xl">📈</span>
					</div>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4 sm:mb-6">
			<div class="flex items-center justify-between mb-3 sm:mb-4">
				<h2 class="text-lg sm:text-xl font-bold text-gray-900">Training Aggregates</h2>
				<div class="flex gap-1">
					<button
						onclick={() => (selectedPeriod = 'week')}
						class:active={selectedPeriod === 'week'}
						class="px-3 py-1.5 rounded transition-colors text-sm {selectedPeriod === 'week'
							? 'bg-blue-600 text-white'
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
						type="button"
					>
						Week
					</button>
					<button
						onclick={() => (selectedPeriod = 'month')}
						class:active={selectedPeriod === 'month'}
						class="px-3 py-1.5 rounded transition-colors text-sm {selectedPeriod === 'month'
							? 'bg-blue-600 text-white'
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
						type="button"
					>
						Month
					</button>
				</div>
			</div>

			{#if selectedPeriod === 'week'}
				<div class="space-y-3 sm:space-y-4">
					<div class="grid grid-cols-2 gap-3 sm:gap-4">
						<div class="bg-blue-50 rounded-lg p-3 sm:p-4">
							<div class="flex items-center justify-between mb-2">
								<span class="text-xs sm:text-sm text-gray-600">Volume</span>
								<span class="text-[10px] sm:text-xs text-gray-500">{formatDateRange(weeklyComparison.current.startDate, weeklyComparison.current.endDate)}</span>
							</div>
							<p class="text-lg sm:text-2xl font-bold text-gray-900">{formatVolume(weeklyComparison.current.volume)} lbs</p>
							<div class="flex items-center gap-1 mt-1">
								{#if weeklyComparison.volumeChange > 0}
									<span class="text-green-600 text-xs sm:text-sm font-medium">↑</span>
									<span class="text-green-600 text-xs sm:text-sm font-medium">
										{weeklyComparison.volumeChangePercent > 0 ? '+' : ''}{weeklyComparison.volumeChangePercent.toFixed(1)}%
									</span>
								{:else if weeklyComparison.volumeChange < 0}
									<span class="text-red-600 text-xs sm:text-sm font-medium">↓</span>
									<span class="text-red-600 text-xs sm:text-sm font-medium">
										{weeklyComparison.volumeChangePercent.toFixed(1)}%
									</span>
								{:else}
									<span class="text-gray-500 text-xs sm:text-sm">-</span>
								{/if}
							</div>
						</div>

						<div class="bg-purple-50 rounded-lg p-3 sm:p-4">
							<div class="flex items-center justify-between mb-2">
								<span class="text-xs sm:text-sm text-gray-600">Workouts</span>
								<span class="text-[10px] sm:text-xs text-gray-500">vs. previous week</span>
							</div>
							<p class="text-lg sm:text-2xl font-bold text-gray-900">{weeklyComparison.current.workoutCount}</p>
							<div class="flex items-center gap-1 mt-1">
								{#if weeklyComparison.workoutCountChange > 0}
									<span class="text-green-600 text-xs sm:text-sm font-medium">↑</span>
									<span class="text-green-600 text-xs sm:text-sm font-medium">
										+{weeklyComparison.workoutCountChange} ({weeklyComparison.workoutCountChangePercent > 0 ? '+' : ''}{weeklyComparison.workoutCountChangePercent.toFixed(1)}%)
									</span>
								{:else if weeklyComparison.workoutCountChange < 0}
									<span class="text-red-600 text-xs sm:text-sm font-medium">↓</span>
									<span class="text-red-600 text-xs sm:text-sm font-medium">
										{weeklyComparison.workoutCountChange} ({weeklyComparison.workoutCountChangePercent.toFixed(1)}%)
									</span>
								{:else}
									<span class="text-gray-500 text-xs sm:text-sm">0 (0%)</span>
								{/if}
							</div>
						</div>
					</div>

					<div class="bg-gray-50 rounded-lg p-2 sm:p-3">
						<span class="text-xs text-gray-500">Previous week: {formatDateRange(weeklyComparison.previous.startDate, weeklyComparison.previous.endDate)} - {formatVolume(weeklyComparison.previous.volume)} lbs, {weeklyComparison.previous.workoutCount} workouts</span>
					</div>
				</div>
			{:else}
				<div class="space-y-3 sm:space-y-4">
					<div class="grid grid-cols-2 gap-3 sm:gap-4">
						<div class="bg-blue-50 rounded-lg p-3 sm:p-4">
							<div class="flex items-center justify-between mb-2">
								<span class="text-xs sm:text-sm text-gray-600">Volume</span>
								<span class="text-[10px] sm:text-xs text-gray-500">{formatDateRange(monthlyComparison.current.startDate, monthlyComparison.current.endDate)}</span>
							</div>
							<p class="text-lg sm:text-2xl font-bold text-gray-900">{formatVolume(monthlyComparison.current.volume)} lbs</p>
							<div class="flex items-center gap-1 mt-1">
								{#if monthlyComparison.volumeChange > 0}
									<span class="text-green-600 text-xs sm:text-sm font-medium">↑</span>
									<span class="text-green-600 text-xs sm:text-sm font-medium">
										{monthlyComparison.volumeChangePercent > 0 ? '+' : ''}{monthlyComparison.volumeChangePercent.toFixed(1)}%
									</span>
								{:else if monthlyComparison.volumeChange < 0}
									<span class="text-red-600 text-xs sm:text-sm font-medium">↓</span>
									<span class="text-red-600 text-xs sm:text-sm font-medium">
										{monthlyComparison.volumeChangePercent.toFixed(1)}%
									</span>
								{:else}
									<span class="text-gray-500 text-xs sm:text-sm">-</span>
								{/if}
							</div>
						</div>

						<div class="bg-purple-50 rounded-lg p-3 sm:p-4">
							<div class="flex items-center justify-between mb-2">
								<span class="text-xs sm:text-sm text-gray-600">Workouts</span>
								<span class="text-[10px] sm:text-xs text-gray-500">vs. previous month</span>
							</div>
							<p class="text-lg sm:text-2xl font-bold text-gray-900">{monthlyComparison.current.workoutCount}</p>
							<div class="flex items-center gap-1 mt-1">
								{#if monthlyComparison.workoutCountChange > 0}
									<span class="text-green-600 text-xs sm:text-sm font-medium">↑</span>
									<span class="text-green-600 text-xs sm:text-sm font-medium">
										+{monthlyComparison.workoutCountChange} ({monthlyComparison.workoutCountChangePercent > 0 ? '+' : ''}{monthlyComparison.workoutCountChangePercent.toFixed(1)}%)
									</span>
								{:else if monthlyComparison.workoutCountChange < 0}
									<span class="text-red-600 text-xs sm:text-sm font-medium">↓</span>
									<span class="text-red-600 text-xs sm:text-sm font-medium">
										{monthlyComparison.workoutCountChange} ({monthlyComparison.workoutCountChangePercent.toFixed(1)}%)
									</span>
								{:else}
									<span class="text-gray-500 text-xs sm:text-sm">0 (0%)</span>
								{/if}
							</div>
						</div>
					</div>

					<div class="bg-gray-50 rounded-lg p-2 sm:p-3">
						<span class="text-xs text-gray-500">Previous month: {formatDateRange(monthlyComparison.previous.startDate, monthlyComparison.previous.endDate)} - {formatVolume(monthlyComparison.previous.volume)} lbs, {monthlyComparison.previous.workoutCount} workouts</span>
					</div>
				</div>
			{/if}
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
			<div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
				<h2 class="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Daily Metrics</h2>
				{#if dailyMetrics.length > 0}
					<div class="space-y-2 max-h-64 overflow-y-auto">
						<div class="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-600 border-b pb-2">
							<span>Date</span>
							<span class="text-center">Workouts</span>
							<span class="text-right">Volume</span>
						</div>
						{#each [...dailyMetrics].reverse() as metric}
							<div
								class="grid grid-cols-3 gap-2 text-xs sm:text-sm py-1 {isLastWorkoutDate(metric.date)
									? 'bg-blue-50 border-l-4 border-blue-600'
									: 'bg-gray-50'} rounded"
							>
								<span class="truncate">{new Date(metric.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
								<span class="text-center {metric.workoutCount === 0 ? 'text-gray-400' : 'font-semibold'}">{metric.workoutCount}</span>
								<span class="text-right {metric.volume === 0 ? 'text-gray-400' : 'font-semibold text-blue-600'}">
									{formatVolume(metric.volume)} lbs
								</span>
							</div>
						{/each}
					</div>
					{#if lastWorkoutDate}
						<div class="mt-3 text-xs text-gray-500">
							Last workout: {lastWorkoutDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
						</div>
					{/if}
				{:else}
					<p class="text-gray-500 text-center py-4 text-sm">No workout data available</p>
				{/if}
			</div>

			<div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
				<h2 class="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Muscle Breakdown</h2>
				{#if muscleGroupBreakdown.length > 0}
					<div class="flex items-center justify-center mb-3 sm:mb-4">
						<svg viewBox="0 0 100 100" class="w-32 h-32 sm:w-48 sm:h-48">
							{#each pieChartData as segment}
								{#if segment.percentage > 0}
									<path
										d="M 50 50 L {
											50 +
											45 *
											Math.cos(
												(segment.startAngle - 90) * (Math.PI / 180)
											)
										} {
											50 +
											45 *
											Math.sin(
												(segment.startAngle - 90) * (Math.PI / 180)
											)
										} A 45 45 0 {
											segment.percentage > 50 ? 1 : 0
										} 1 {
											50 +
											45 *
											Math.cos(
												(segment.endAngle - 90) * (Math.PI / 180)
											)
										} {
											50 +
											45 *
											Math.sin(
												(segment.endAngle - 90) * (Math.PI / 180)
											)
										} Z"
										fill={[
											'#3b82f6',
											'#10b981',
											'#f59e0b',
											'#ef4444',
											'#8b5cf6',
											'#ec4899',
											'#06b6d4'
										][muscleGroupBreakdown.findIndex((item) => item.muscle === segment.muscle)]}
										stroke="white"
										stroke-width="1"
									/>
								{/if}
							{/each}
						</svg>
					</div>
					<div class="grid grid-cols-2 gap-1 sm:gap-2">
						{#each muscleGroupBreakdown.slice(0, 6) as { muscle, count }}
							<div class="flex items-center justify-between p-2 bg-gray-50 rounded">
								<span class="capitalize text-xs sm:text-sm">{muscle}</span>
								<span class="font-semibold text-xs sm:text-sm">{count} ({(
									pieChartData.find((s) => s.muscle === muscle)?.percentage || 0
								).toFixed(0)}%)</span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-gray-500 text-center py-8 sm:py-12 text-sm">No workout data available</p>
				{/if}
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
			<h2 class="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Volume Trends</h2>
			{#if volumeTrends.some((t) => t.volume > 0)}
				<div class="h-48 sm:h-64">
					<svg viewBox="0 0 800 200" class="w-full h-full">
						{#each volumeTrends as trend, i}
							{#if trend.volume > 0}
								<line
									x1={i * (800 / volumeTrends.length)}
									y1={200 - (trend.volume / Math.max(...volumeTrends.map((t) => t.volume))) * 180}
									x2={(i + 1) * (800 / volumeTrends.length)}
									y2={200 -
										(volumeTrends[i + 1]?.volume || trend.volume) /
											Math.max(...volumeTrends.map((t) => t.volume)) * 180}
									stroke="#3b82f6"
									stroke-width="2"
								/>
								<circle
									cx={i * (800 / volumeTrends.length) + 800 / volumeTrends.length / 2}
									cy={200 - (trend.volume / Math.max(...volumeTrends.map((t) => t.volume))) * 180}
									r="4"
									fill="#3b82f6"
								/>
							{/if}
						{/each}
						{#each volumeTrends as trend, i}
							<text
								x={i * (800 / volumeTrends.length) + 800 / volumeTrends.length / 2}
								y={195}
								text-anchor="middle"
								class="text-xs"
								fill="#6b7280"
							>
								{i % 2 === 0 ? trend.date : ''}
							</text>
						{/each}
					</svg>
				</div>
				<div class="mt-3 sm:mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
					{#each volumeTrends.slice(-4).reverse() as trend}
						<div class="text-xs sm:text-sm">
							<p class="text-gray-500">{trend.date}</p>
							<p class="font-semibold">{formatVolume(trend.volume)} lbs</p>
							<p class="text-[10px] sm:text-xs text-gray-400">{trend.sessions} session{trend.sessions !== 1 ? 's' : ''}</p>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-gray-500 text-center py-8 sm:py-12 text-sm">No volume data available</p>
			{/if}
		{/if}
	</div>
</div>
