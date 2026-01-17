<script lang="ts">
	import { onMount } from 'svelte';
	import { db, liveQuery } from '$lib/db';
	import type { Session, Exercise } from '$lib/types';

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
		
		return sessions.filter((session) => {
			const sessionDate = new Date(session.date);
			return sessionDate >= startDate && sessionDate <= endDate;
		});
	});

	const totalSessions = $derived(filteredSessions.length);

	const totalTrainingTime = $derived.by(() => {
		return filteredSessions.reduce((acc, session) => acc + session.duration, 0);
	});

	const workoutCalendar = $derived.by(() => {
		const calendar: Record<string, number> = {};
		const now = new Date();
		
		const dateRange = 30;
		for (let i = dateRange - 1; i >= 0; i--) {
			const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
			const dateStr = date.toISOString().split('T')[0];
			calendar[dateStr] = 0;
		}

		filteredSessions.forEach((session) => {
			const sessionDate = new Date(session.date).toISOString().split('T')[0];
			if (calendar.hasOwnProperty(sessionDate)) {
				calendar[sessionDate]++;
			}
		});

		return calendar;
	});

	const muscleGroupBreakdown = $derived.by(() => {
		const breakdown: Record<string, number> = {
			chest: 0,
			back: 0,
			legs: 0,
			shoulders: 0,
			arms: 0,
			core: 0,
			'full-body': 0
		};

		filteredSessions.forEach((session) => {
			const uniqueMuscles = new Set<string>();
			session.exercises.forEach((exercise) => {
				uniqueMuscles.add(exercise.primaryMuscle);
			});
			uniqueMuscles.forEach((muscle) => {
				breakdown[muscle] = (breakdown[muscle] || 0) + 1;
			});
		});

		return Object.entries(breakdown)
			.filter(([_, count]) => count > 0)
			.sort((a, b) => b[1] - a[1]);
	});

	const volumeTrends = $derived.by(() => {
		const trends: Array<{ date: string; volume: number; sessions: number }> = [];
		const now = new Date();
		
		const weeks = { week: 7, month: 4, year: 12, custom: 12 }[dateFilter];
		
		for (let i = weeks - 1; i >= 0; i--) {
			const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i + 1) * 7);
			const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
			
			const weekSessions = filteredSessions.filter((session) => {
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
		const total = muscleGroupBreakdown.reduce((acc, [_, count]) => acc + count, 0);
		let currentAngle = 0;
		
		return muscleGroupBreakdown.map(([muscle, count]) => {
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

<div class="min-h-screen bg-gray-100 p-4 md:p-8">
	<div class="max-w-7xl mx-auto">
		<div class="flex items-center justify-between mb-6">
			<div class="flex items-center gap-4">
				<a
					href="/"
					class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
				>
					← Back
				</a>
				<h1 class="text-3xl font-bold text-gray-900">Workout Analytics Dashboard</h1>
			</div>
			<div class="flex gap-2">
				<button
					onclick={() => (dateFilter = 'week')}
					class:active={dateFilter === 'week'}
					class="px-4 py-2 rounded-lg transition-colors {dateFilter === 'week'
						? 'bg-blue-600 text-white'
						: 'bg-white text-gray-700 hover:bg-gray-50'}"
					type="button"
				>
					Week
				</button>
				<button
					onclick={() => (dateFilter = 'month')}
					class:active={dateFilter === 'month'}
					class="px-4 py-2 rounded-lg transition-colors {dateFilter === 'month'
						? 'bg-blue-600 text-white'
						: 'bg-white text-gray-700 hover:bg-gray-50'}"
					type="button"
				>
					Month
				</button>
				<button
					onclick={() => (dateFilter = 'year')}
					class:active={dateFilter === 'year'}
					class="px-4 py-2 rounded-lg transition-colors {dateFilter === 'year'
						? 'bg-blue-600 text-white'
						: 'bg-white text-gray-700 hover:bg-gray-50'}"
					type="button"
				>
					Year
				</button>
				<button
					onclick={() => (dateFilter = 'custom')}
					class:active={dateFilter === 'custom'}
					class="px-4 py-2 rounded-lg transition-colors {dateFilter === 'custom'
						? 'bg-blue-600 text-white'
						: 'bg-white text-gray-700 hover:bg-gray-50'}"
					type="button"
				>
					Custom
				</button>
			</div>
		</div>

		{#if dateFilter === 'custom'}
			<div class="bg-white rounded-lg shadow-md p-4 mb-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="start-date" class="block text-sm font-medium text-gray-700 mb-1">
							Start Date
						</label>
						<input
							id="start-date"
							type="date"
							bind:value={customStartDate}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
					<div>
						<label for="end-date" class="block text-sm font-medium text-gray-700 mb-1">
							End Date
						</label>
						<input
							id="end-date"
							type="date"
							bind:value={customEndDate}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
			<div class="bg-white rounded-lg shadow-md p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-500">Total Sessions</p>
						<p class="text-3xl font-bold text-gray-900">{totalSessions}</p>
					</div>
					<div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
						<span class="text-2xl">📊</span>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow-md p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-500">Total Training Time</p>
						<p class="text-3xl font-bold text-gray-900">{formatTime(totalTrainingTime)}</p>
					</div>
					<div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
						<span class="text-2xl">⏱️</span>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow-md p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-500">Volume Lifted</p>
						<p class="text-3xl font-bold text-gray-900">{formatVolume(volumeTrends.reduce((acc, t) => acc + t.volume, 0))} lbs</p>
					</div>
					<div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
						<span class="text-2xl">🏋️</span>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow-md p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-500">Avg Session Duration</p>
						<p class="text-3xl font-bold text-gray-900">
							{totalSessions > 0 ? formatTime(totalTrainingTime / totalSessions) : '0m'}
						</p>
					</div>
					<div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
						<span class="text-2xl">📈</span>
					</div>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
			<div class="bg-white rounded-lg shadow-md p-6">
				<h2 class="text-xl font-bold text-gray-900 mb-4">Workout Frequency (Last 30 Days)</h2>
				<div class="grid grid-cols-7 gap-2">
					<div class="grid grid-cols-7 gap-2 col-span-7">
						{#each Object.entries(workoutCalendar).reverse() as [date, count]}
							<div
								class="aspect-square rounded {getCalendarColor(count)} flex items-center justify-center text-xs font-medium"
								title="{new Date(date).toLocaleDateString()}: {count} session{count !== 1 ? 's' : ''}"
							>
								{count}
							</div>
						{/each}
					</div>
				</div>
				<div class="flex items-center justify-between mt-4 text-sm text-gray-500">
					<span>Less</span>
					<div class="flex gap-1">
						<div class="w-4 h-4 bg-gray-100 rounded"></div>
						<div class="w-4 h-4 bg-green-200 rounded"></div>
						<div class="w-4 h-4 bg-green-400 rounded"></div>
						<div class="w-4 h-4 bg-green-600 rounded"></div>
					</div>
					<span>More</span>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow-md p-6">
				<h2 class="text-xl font-bold text-gray-900 mb-4">Muscle Group Breakdown</h2>
				{#if muscleGroupBreakdown.length > 0}
					<div class="flex items-center justify-center mb-4">
						<svg viewBox="0 0 100 100" class="w-48 h-48">
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
										][muscleGroupBreakdown.findIndex(([m, _]) => m === segment.muscle)]}
										stroke="white"
										stroke-width="1"
									/>
								{/if}
							{/each}
						</svg>
					</div>
					<div class="grid grid-cols-2 gap-2">
						{#each muscleGroupBreakdown.slice(0, 6) as [muscle, count]}
							<div class="flex items-center justify-between p-2 bg-gray-50 rounded">
								<span class="capitalize">{muscle}</span>
								<span class="font-semibold">{count} ({(
									pieChartData.find((s) => s.muscle === muscle)?.percentage || 0
								).toFixed(0)}%)</span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-gray-500 text-center py-12">No workout data available</p>
				{/if}
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Volume Trends Over Time</h2>
			{#if volumeTrends.some((t) => t.volume > 0)}
				<div class="h-64">
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
				<div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
					{#each volumeTrends.slice(-4).reverse() as trend}
						<div class="text-sm">
							<p class="text-gray-500">{trend.date}</p>
							<p class="font-semibold">{formatVolume(trend.volume)} lbs</p>
							<p class="text-xs text-gray-400">{trend.sessions} session{trend.sessions !== 1 ? 's' : ''}</p>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-gray-500 text-center py-12">No volume data available</p>
			{/if}
		</div>
	</div>
</div>
