<script lang="ts">
	import { onMount } from 'svelte';
	import { db, liveQuery } from '$lib/db';
	import type { Session, Exercise } from '$lib/types';
		import {
			filterSessionsByDateRange,
			calculateDashboardMetrics,
			calculateVolumeTrends,
			calculateMuscleBreakdown,
			calculateDailyWorkouts
		} from '$lib/dashboardMetrics';

	let sessions = $state<Session[]>([]);
	let allExercises = $state<Exercise[]>([]);
	let dateFilter = $state<'week' | 'month' | 'year' | 'custom'>('month');
	let customStartDate = $state('');
	let customEndDate = $state('');

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

	const muscleGroupBreakdown = $derived.by(() => {
		return calculateMuscleBreakdown(filteredSessions);
	});

	const volumeTrends = $derived.by(() => {
		const startDate = customStartDate ? new Date(customStartDate) : undefined;
		const endDate = customEndDate ? new Date(customEndDate) : undefined;
		return calculateVolumeTrends(filteredSessions, dateFilter, startDate, endDate);
	});

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

	function getCalendarColor(count: number): string {
		if (count === 0) return 'bg-gray-100';
		if (count === 1) return 'bg-green-200';
		if (count === 2) return 'bg-green-400';
		return 'bg-green-600';
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

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
			<div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
				<h2 class="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Workout Frequency</h2>
				<div class="grid grid-cols-7 gap-1 sm:gap-2">
					<div class="grid grid-cols-7 gap-1 sm:gap-2 col-span-7">
						{#each [...workoutCalendar].reverse() as entry}
							<div
								class="aspect-square rounded {getCalendarColor(entry.count)} flex items-center justify-center text-[10px] sm:text-xs font-medium"
								title="{new Date(entry.date).toLocaleDateString()}: {entry.count} session{entry.count !== 1 ? 's' : ''}"
							>
								{entry.count}
							</div>
						{/each}
					</div>
				</div>
				<div class="flex items-center justify-between mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500">
					<span>Less</span>
					<div class="flex gap-1">
						<div class="w-3 h-3 sm:w-4 sm:h-4 bg-gray-100 rounded"></div>
						<div class="w-3 h-3 sm:w-4 sm:h-4 bg-green-200 rounded"></div>
						<div class="w-3 h-3 sm:w-4 sm:h-4 bg-green-400 rounded"></div>
						<div class="w-3 h-3 sm:w-4 sm:h-4 bg-green-600 rounded"></div>
					</div>
					<span>More</span>
				</div>
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
		</div>
	</div>
</div>
