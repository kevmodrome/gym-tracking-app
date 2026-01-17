<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import type { Exercise, Session } from '$lib/types';
	import Chart from 'chart.js/auto';
	import zoomPlugin from 'chartjs-plugin-zoom';

	Chart.register(zoomPlugin);

	let exercises = $state<Exercise[]>([]);
	let sessions = $state<Session[]>([]);
	let selectedExercise = $state<Exercise | undefined>(undefined);
	let selectedMetric = $state<'weight' | 'volume' | 'reps'>('weight');
	let chartInstance: Chart | null = null;
	let chartCanvas: HTMLCanvasElement;

	onMount(async () => {
		exercises = await db.exercises.toArray();
		sessions = await db.sessions.orderBy('date').toArray();
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
					(sum, set) => sum + set.weight * set.reps,
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

		if (!chartData || chartData.length === 0) {
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
						borderColor: 'rgb(59, 130, 246)',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						fill: true,
						tension: 0.1,
						pointRadius: 6,
						pointHoverRadius: 8,
						pointBackgroundColor: 'rgb(59, 130, 246)',
						pointBorderColor: '#fff',
						pointBorderWidth: 2
					},
					{
						label: 'Trend',
						data: trendData,
						borderColor: 'rgb(239, 68, 68)',
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
						position: 'top'
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
							text: 'Date'
						}
					},
					y: {
						title: {
							display: true,
							text: getMetricLabel()
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

	function handleExerciseChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		selectedExercise = exercises.find((ex) => ex.id === select.value);
	}

	function resetZoom() {
		if (chartInstance) {
			(chartInstance as any).resetZoom();
		}
	}

	function formatMuscle(muscle: string): string {
		return muscle.charAt(0).toUpperCase() + muscle.slice(1);
	}
</script>

<svelte:head>
	<title>Exercise Progress - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-gray-100 p-4 md:p-8">
	<div class="max-w-6xl mx-auto">
		<div class="mb-6">
			<a href="/" class="text-blue-600 hover:text-blue-800">&larr; Back to Exercises</a>
		</div>

		<h1 class="text-3xl font-bold text-gray-900 mb-6">Exercise Progress</h1>

		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
				<div>
					<label for="exercise-select" class="block text-sm font-medium text-gray-700 mb-1">
						Select Exercise
					</label>
					<select
						id="exercise-select"
						onchange={handleExerciseChange}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						<option value="">Choose an exercise</option>
						{#each exercises as exercise}
							<option value={exercise.id}>
								{exercise.name} ({formatMuscle(exercise.primary_muscle)})
							</option>
						{/each}
					</select>
				</div>

				{#if selectedExercise}
					<div>
						<label for="metric-select" class="block text-sm font-medium text-gray-700 mb-1">
							Metric
						</label>
						<select
							id="metric-select"
							bind:value={selectedMetric}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="weight">Weight (lbs)</option>
							<option value="volume">Volume (lbs × reps)</option>
							<option value="reps">Max Reps</option>
						</select>
					</div>
				{/if}
			</div>
		</div>

		{#if !selectedExercise}
			<div class="bg-white rounded-lg shadow-md p-12 text-center">
				<div class="text-gray-400 mb-4">
					<svg
						class="w-16 h-16 mx-auto"
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
				<h2 class="text-xl font-semibold text-gray-900 mb-2">Select an Exercise</h2>
				<p class="text-gray-600">Choose an exercise from the dropdown to view its progress</p>
			</div>
		{:else if exerciseSessions.length === 0}
			<div class="bg-white rounded-lg shadow-md p-12 text-center">
				<div class="text-gray-400 mb-4">
					<svg
						class="w-16 h-16 mx-auto"
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
				<h2 class="text-xl font-semibold text-gray-900 mb-2">No Data Yet</h2>
				<p class="text-gray-600">
					You haven't logged any sessions for <strong>{selectedExercise.name}</strong> yet.
					Start logging workouts to see your progress!
				</p>
			</div>
		{:else}
			<div class="bg-white rounded-lg shadow-md p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-semibold text-gray-900">{selectedExercise.name}</h2>
					<button
						onclick={resetZoom}
						class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
						type="button"
					>
						Reset Zoom
					</button>
				</div>

				<div class="mb-4 text-sm text-gray-600">
					<p>
						<strong>{exerciseSessions.length}</strong> sessions logged &bull; Toggle metrics to
						view different aspects of your progress
					</p>
				</div>

				<div class="h-96">
					<canvas bind:this={chartCanvas}></canvas>
				</div>

				<div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
					{#if chartData}
						<div class="bg-blue-50 rounded-lg p-4">
							<p class="text-sm text-blue-600 font-medium mb-1">Latest</p>
							<p class="text-2xl font-bold text-blue-800">
								{chartData[chartData.length - 1].value}{getMetricUnit()}
							</p>
						</div>
						<div class="bg-green-50 rounded-lg p-4">
							<p class="text-sm text-green-600 font-medium mb-1">Best</p>
							<p class="text-2xl font-bold text-green-800">
								{Math.max(...chartData.map((d) => d.value))}
								{getMetricUnit()}
							</p>
						</div>
						<div class="bg-purple-50 rounded-lg p-4">
							<p class="text-sm text-purple-600 font-medium mb-1">Average</p>
							<p class="text-2xl font-bold text-purple-800">
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
	</div>
</div>
