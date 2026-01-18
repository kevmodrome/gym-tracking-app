<script lang="ts">
	import { onMount } from 'svelte';
	import { db, liveQuery } from '$lib/db';
	import type { Exercise, Session } from '$lib/types';
	import Chart from 'chart.js/auto';
	import zoomPlugin from 'chartjs-plugin-zoom';
	import { Select } from '$lib/ui';

	Chart.register(zoomPlugin);

	let exercises = $state<Exercise[]>([]);
	let sessions = $state<Session[]>([]);
	let selectedExercise = $state<Exercise | undefined>(undefined);
	let selectedMetric = $state<'weight' | 'volume' | 'reps'>('weight');
	let chartInstance = $state<Chart | null>(null);
	let chartCanvas = $state<HTMLCanvasElement>();

	onMount(async () => {
		exercises = await db.exercises.toArray();

		liveQuery(() => db.sessions.orderBy('date').reverse().toArray()).subscribe((data) => {
			sessions = data;
		});
	});

	let exerciseSessions = $derived.by(() => {
		if (!selectedExercise) return [];
		return sessions
			.filter((session) =>
				session.exercises.some((ex) => ex.exerciseId === selectedExercise!.id)
			)
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	});

	let chartData = $derived.by(() => {
		if (!selectedExercise || exerciseSessions.length === 0) return null;

		const dataPoints = exerciseSessions.map((session) => {
			const exerciseInSession = session.exercises.find(
				(ex) => ex.exerciseId === selectedExercise!.id
			);
			if (!exerciseInSession) return null;

			if (selectedMetric === 'weight') {
				const maxWeight = Math.max(...exerciseInSession.sets.map((set) => set.weight));
				return { date: session.date, value: maxWeight };
			} else if (selectedMetric === 'volume') {
				const totalVolume = exerciseInSession.sets.reduce(
					(sum, set) => sum + (set.completed ? set.weight * set.reps : 0),
					0
				);
				return { date: session.date, value: totalVolume };
			} else {
				const maxReps = Math.max(...exerciseInSession.sets.map((set) => set.reps));
				return { date: session.date, value: maxReps };
			}
		}).filter((point): point is { date: string; value: number } => point !== null);

		return dataPoints;
	});

	$effect(() => {
		if (chartCanvas && chartData) {
			updateChart();
		}
	});

	function updateChart() {
		if (chartInstance) {
			chartInstance.destroy();
		}

		if (!chartCanvas || !chartData || chartData.length === 0) {
			return;
		}

		const labels = chartData.map((point) => {
			const date = new Date(point.date);
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		});

		const values = chartData.map((point) => point.value);
		const trendData = calculateTrendLine(values);

		chartInstance = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels: labels,
				datasets: [
					{
						label: getMetricLabel(),
						data: values,
						borderColor: '#c5ff00',
						backgroundColor: 'rgba(197, 255, 0, 0.1)',
						fill: true,
						tension: 0.1,
						pointRadius: 6,
						pointHoverRadius: 8,
						pointBackgroundColor: '#c5ff00',
						pointBorderColor: '#0a0b0f',
						pointBorderWidth: 2
					},
					{
						label: 'Trend',
						data: trendData,
						borderColor: '#7c5cff',
						backgroundColor: 'transparent',
						borderDash: [5, 5],
						tension: 0,
						pointRadius: 0,
						fill: false
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'top',
						labels: {
							color: '#8b8d97'
						}
					},
					tooltip: {
						mode: 'index',
						intersect: false,
						callbacks: {
							label: (context: any) => {
								if (context.datasetIndex === 0) {
									return `${getMetricLabel()}: ${context.parsed.y}${getMetricUnit()}`;
								}
								return context.dataset.label;
							}
						}
					},
					zoom: {
						zoom: {
							wheel: { enabled: true },
							pinch: { enabled: true },
							mode: 'x'
						},
						pan: {
							enabled: true,
							mode: 'x'
						}
					}
				} as any,
				scales: {
					x: {
						title: {
							display: true,
							text: 'Date',
							color: '#8b8d97'
						},
						ticks: {
							color: '#8b8d97'
						},
						grid: {
							color: '#2a2b32'
						}
					},
					y: {
						title: {
							display: true,
							text: getMetricLabel(),
							color: '#8b8d97'
						},
						ticks: {
							color: '#8b8d97'
						},
						grid: {
							color: '#2a2b32'
						},
						beginAtZero: selectedMetric === 'volume' || selectedMetric === 'reps'
					}
				}
			}
		});
	}

	function calculateTrendLine(data: number[]): number[] {
		if (data.length < 2) return data;

		const n = data.length;
		let sumX = 0,
			sumY = 0,
			sumXY = 0,
			sumX2 = 0;

		for (let i = 0; i < n; i++) {
			sumX += i;
			sumY += data[i];
			sumXY += i * data[i];
			sumX2 += i * i;
		}

		const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
		const intercept = (sumY - slope * sumX) / n;

		return data.map((_, i) => slope * i + intercept);
	}

	function getMetricLabel(): string {
		switch (selectedMetric) {
			case 'weight':
				return 'Weight (lbs)';
			case 'volume':
				return 'Volume (lbs)';
			case 'reps':
				return 'Max Reps';
		}
	}

	function getMetricUnit(): string {
		switch (selectedMetric) {
			case 'weight':
				return ' lbs';
			case 'volume':
				return ' lbs';
			case 'reps':
				return ' reps';
		}
	}

	function handleExerciseChange(value: string | number) {
		selectedExercise = exercises.find((ex) => ex.id === value);
	}

	const exerciseOptions = $derived(
		exercises.map((ex) => ({
			value: ex.id,
			label: `${ex.name} (${formatMuscle(ex.primary_muscle)})`
		}))
	);

	const metricOptions = [
		{ value: 'weight', label: 'Weight (lbs)' },
		{ value: 'volume', label: 'Volume (lbs × reps)' },
		{ value: 'reps', label: 'Max Reps' }
	];

	function resetZoom() {
		if (chartInstance) {
			(chartInstance as any).resetZoom();
		}
	}

	function formatMuscle(muscle: string): string {
		return muscle.charAt(0).toUpperCase() + muscle.slice(1);
	}
</script>

<div class="bg-surface rounded-xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
		<Select
			value={selectedExercise?.id ?? ''}
			options={exerciseOptions}
			label="Select Exercise"
			placeholder="Choose an exercise"
			size="sm"
			onchange={handleExerciseChange}
		/>

		{#if selectedExercise}
			<Select
				bind:value={selectedMetric}
				options={metricOptions}
				label="Metric"
				size="sm"
			/>
		{/if}
	</div>
</div>

{#if !selectedExercise}
	<div class="bg-surface rounded-xl border border-border p-8 sm:p-12 text-center">
		<div class="text-text-muted mb-3 sm:mb-4">
			<svg
				class="w-12 h-12 sm:w-16 sm:h-16 mx-auto"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
				/>
			</svg>
		</div>
		<h2 class="text-lg sm:text-xl font-semibold text-text-primary mb-2">Select an Exercise</h2>
		<p class="text-sm sm:text-base text-text-secondary">Choose an exercise from the dropdown to view its progress</p>
	</div>
{:else if exerciseSessions.length === 0}
	<div class="bg-surface rounded-xl border border-border p-8 sm:p-12 text-center">
		<div class="text-text-muted mb-3 sm:mb-4">
			<svg
				class="w-12 h-12 sm:w-16 sm:h-16 mx-auto"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
				/>
			</svg>
		</div>
		<h2 class="text-lg sm:text-xl font-semibold text-text-primary mb-2">No Data Yet</h2>
		<p class="text-sm sm:text-base text-text-secondary">
			You haven't logged any sessions for <strong class="text-text-primary">{selectedExercise.name}</strong> yet.
			Start logging workouts to see your progress!
		</p>
	</div>
{:else}
	<div class="bg-surface rounded-xl border border-border p-4 sm:p-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
			<h2 class="text-lg sm:text-xl font-semibold text-text-primary">{selectedExercise.name}</h2>
			<button
				onclick={resetZoom}
				class="px-3 py-2 bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors text-sm min-h-[44px]"
				type="button"
			>
				Reset Zoom
			</button>
		</div>

		<div class="mb-4 text-xs sm:text-sm text-text-secondary">
			<p>
				<strong class="text-text-primary">{exerciseSessions.length}</strong> sessions logged &bull; Toggle metrics to
				view different aspects of your progress
			</p>
		</div>

		<div class="h-64 sm:h-80 md:h-96">
			<canvas bind:this={chartCanvas}></canvas>
		</div>

		<div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
			{#if chartData}
				<div class="bg-accent/10 rounded-lg p-3 sm:p-4">
					<p class="text-xs sm:text-sm text-accent font-medium mb-1">Latest</p>
					<p class="text-xl sm:text-2xl font-display font-bold text-accent">
						{chartData[chartData.length - 1].value}{getMetricUnit()}
					</p>
				</div>
				<div class="bg-success/10 rounded-lg p-3 sm:p-4">
					<p class="text-xs sm:text-sm text-success font-medium mb-1">Best</p>
					<p class="text-xl sm:text-2xl font-display font-bold text-success">
						{Math.max(...chartData.map((d) => d.value))}
						{getMetricUnit()}
					</p>
				</div>
				<div class="bg-secondary/10 rounded-lg p-3 sm:p-4">
					<p class="text-xs sm:text-sm text-secondary font-medium mb-1">Average</p>
					<p class="text-xl sm:text-2xl font-display font-bold text-secondary">
						{Math.round(
							chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length
						)}
						{getMetricUnit()}
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}
