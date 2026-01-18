<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { db, liveQuery } from '$lib/db';
	import type { Exercise, Session } from '$lib/types';
	import { getPersonalRecordsForExercise, getPRHistoryForExercise, getRepRangeLabel } from '$lib/prUtils';
	import type { PersonalRecord } from '$lib/types';
	import Chart from 'chart.js/auto';
	import zoomPlugin from 'chartjs-plugin-zoom';
	import { Button, Card, Modal, Select } from '$lib/ui';
	import { ArrowLeft, Edit, Trash2 } from 'lucide-svelte';

	Chart.register(zoomPlugin);

	const exerciseId = $derived($page.params.id);

	let exercise = $state<Exercise | null>(null);
	let sessions = $state<Session[]>([]);
	let personalRecords = $state<PersonalRecord[]>([]);
	let selectedMetric = $state<'weight' | 'volume' | 'reps'>('weight');
	let chartInstance: Chart | null = null;
	let chartCanvas = $state<HTMLCanvasElement>();
	let selectedPR = $state<PersonalRecord | null>(null);
	let prHistory = $state<any[]>([]);
	let loading = $state(true);

	onMount(async () => {
		exercise = await db.exercises.get(exerciseId) ?? null;
		if (!exercise) {
			goto('/exercises');
			return;
		}

		personalRecords = await getPersonalRecordsForExercise(exerciseId);

		liveQuery(() => db.sessions.orderBy('date').reverse().toArray()).subscribe((data) => {
			sessions = data.filter(s =>
				s.exercises.some(e => e.exerciseId === exerciseId)
			);
			loading = false;
		});
	});

	const exerciseSessions = $derived.by(() => {
		return [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	});

	const chartData = $derived.by(() => {
		if (exerciseSessions.length === 0) return null;

		const dataPoints = exerciseSessions.map((session) => {
			const exerciseInSession = session.exercises.find(
				(ex) => ex.exerciseId === exerciseId
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
		if (chartCanvas && chartData && chartData.length > 0) {
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
						labels: { color: '#8b8d97' }
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
						pan: { enabled: true, mode: 'x' }
					}
				} as any,
				scales: {
					x: {
						title: { display: true, text: 'Date', color: '#8b8d97' },
						ticks: { color: '#8b8d97' },
						grid: { color: '#2a2b32' }
					},
					y: {
						title: { display: true, text: getMetricLabel(), color: '#8b8d97' },
						ticks: { color: '#8b8d97' },
						grid: { color: '#2a2b32' },
						beginAtZero: selectedMetric === 'volume' || selectedMetric === 'reps'
					}
				}
			}
		});
	}

	function calculateTrendLine(data: number[]): number[] {
		if (data.length < 2) return data;
		const n = data.length;
		let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
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
			case 'weight': return 'Weight (lbs)';
			case 'volume': return 'Volume (lbs)';
			case 'reps': return 'Max Reps';
		}
	}

	function getMetricUnit(): string {
		switch (selectedMetric) {
			case 'weight': return ' lbs';
			case 'volume': return ' lbs';
			case 'reps': return ' reps';
		}
	}

	function resetZoom() {
		if (chartInstance) {
			(chartInstance as any).resetZoom();
		}
	}

	async function showHistory(pr: PersonalRecord) {
		selectedPR = pr;
		prHistory = await getPRHistoryForExercise(pr.exerciseId, pr.reps);
	}

	function closeHistory() {
		selectedPR = null;
		prHistory = [];
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatMuscle(muscle: string): string {
		return muscle.charAt(0).toUpperCase() + muscle.slice(1);
	}
</script>

<svelte:head>
	<title>{exercise?.name ?? 'Exercise'} - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-4xl mx-auto w-full">
		{#if loading}
			<div class="flex items-center justify-center min-h-[50vh]">
				<div class="text-text-muted">Loading...</div>
			</div>
		{:else if exercise}
			<!-- Header -->
			<div class="flex items-center gap-4 mb-6">
				<Button variant="ghost" href="/exercises">
					<ArrowLeft class="w-5 h-5" />
				</Button>
				<div class="flex-1">
					<div class="flex items-center gap-3">
						<h1 class="text-2xl sm:text-3xl font-bold font-display text-text-primary">{exercise.name}</h1>
						{#if exercise.is_custom}
							<span class="px-2 py-1 text-xs font-medium bg-accent/20 text-accent rounded-full">
								Custom
							</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Exercise Details -->
			<Card class="mb-6">
				{#snippet children()}
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
						<div>
							<p class="text-xs text-text-muted mb-1">Category</p>
							<p class="text-sm font-medium text-text-primary capitalize">{exercise.category}</p>
						</div>
						<div>
							<p class="text-xs text-text-muted mb-1">Primary Muscle</p>
							<p class="text-sm font-medium text-text-primary capitalize">{exercise.primary_muscle}</p>
						</div>
						<div>
							<p class="text-xs text-text-muted mb-1">Equipment</p>
							<p class="text-sm font-medium text-text-primary">{exercise.equipment}</p>
						</div>
						<div>
							<p class="text-xs text-text-muted mb-1">Sessions</p>
							<p class="text-sm font-medium text-text-primary">{exerciseSessions.length}</p>
						</div>
					</div>
					{#if exercise.secondary_muscles.length > 0}
						<div class="mt-4 pt-4 border-t border-border">
							<p class="text-xs text-text-muted mb-2">Secondary Muscles</p>
							<div class="flex flex-wrap gap-2">
								{#each exercise.secondary_muscles as muscle}
									<span class="text-xs bg-surface-elevated text-text-secondary px-2 py-1 rounded capitalize">
										{muscle}
									</span>
								{/each}
							</div>
						</div>
					{/if}
				{/snippet}
			</Card>

			<!-- Personal Records -->
			{#if personalRecords.length > 0}
				<Card class="mb-6">
					{#snippet children()}
						<h2 class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
							<span class="text-xl">🏆</span> Personal Records
						</h2>
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{#each personalRecords as pr}
								<button
									onclick={() => showHistory(pr)}
									class="flex items-center gap-3 p-3 bg-gradient-to-r from-warning/10 to-warning/5 rounded-lg border border-warning/30 hover:border-warning/50 transition-colors text-left"
								>
									<div class="w-10 h-10 bg-warning text-bg rounded-full flex items-center justify-center font-bold flex-shrink-0 shadow-[0_0_15px_rgba(255,149,0,0.4)]">
										🏆
									</div>
									<div class="flex-1 min-w-0">
										<p class="font-semibold text-text-primary text-sm">
											{getRepRangeLabel(pr.reps)}: {pr.weight} lbs
										</p>
										<p class="text-xs text-text-muted">
											{formatDate(pr.achievedDate)}
										</p>
									</div>
								</button>
							{/each}
						</div>
					{/snippet}
				</Card>
			{/if}

			<!-- Progress Chart -->
			<Card class="mb-6">
				{#snippet children()}
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
						<h2 class="text-lg font-semibold text-text-primary">Progress Chart</h2>
						<div class="flex items-center gap-2">
							<Select
								bind:value={selectedMetric}
								size="sm"
								options={[
									{ value: 'weight', label: 'Weight (lbs)' },
									{ value: 'volume', label: 'Volume (lbs × reps)' },
									{ value: 'reps', label: 'Max Reps' }
								]}
							/>
							{#if chartData && chartData.length > 0}
								<button
									onclick={resetZoom}
									class="px-3 py-2 bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors text-sm min-h-[44px]"
								>
									Reset Zoom
								</button>
							{/if}
						</div>
					</div>

					{#if exerciseSessions.length === 0}
						<div class="text-center py-8">
							<p class="text-text-secondary">No session data yet. Start working out to see your progress!</p>
						</div>
					{:else}
						<div class="h-64 sm:h-80">
							<canvas bind:this={chartCanvas}></canvas>
						</div>
						{#if chartData && chartData.length > 0}
							<div class="mt-4 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
								<div class="bg-accent/10 rounded-lg p-3">
									<p class="text-xs text-accent font-medium mb-1">Latest</p>
									<p class="text-lg font-bold text-accent">
										{chartData[chartData.length - 1].value}{getMetricUnit()}
									</p>
								</div>
								<div class="bg-success/10 rounded-lg p-3">
									<p class="text-xs text-success font-medium mb-1">Best</p>
									<p class="text-lg font-bold text-success">
										{Math.max(...chartData.map(d => d.value))}{getMetricUnit()}
									</p>
								</div>
								<div class="bg-secondary/10 rounded-lg p-3">
									<p class="text-xs text-secondary font-medium mb-1">Average</p>
									<p class="text-lg font-bold text-secondary">
										{Math.round(chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length)}{getMetricUnit()}
									</p>
								</div>
							</div>
						{/if}
					{/if}
				{/snippet}
			</Card>

			<!-- Recent Sessions -->
			{#if exerciseSessions.length > 0}
				<Card>
					{#snippet children()}
						<h2 class="text-lg font-semibold text-text-primary mb-4">Recent Sessions</h2>
						<div class="space-y-3">
							{#each exerciseSessions.slice(-5).reverse() as session}
								{@const exerciseData = session.exercises.find(e => e.exerciseId === exerciseId)}
								{#if exerciseData}
									<div class="p-3 bg-surface-elevated rounded-lg border border-border">
										<div class="flex items-center justify-between mb-2">
											<p class="font-medium text-text-primary">{session.workoutName}</p>
											<p class="text-xs text-text-muted">{formatDate(session.date)}</p>
										</div>
										<div class="flex flex-wrap gap-2">
											{#each exerciseData.sets as set, idx}
												<span class="text-xs px-2 py-1 rounded {set.completed ? 'bg-success/20 text-success' : 'bg-surface text-text-muted'}">
													{set.reps} × {set.weight}lbs
												</span>
											{/each}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/snippet}
				</Card>
			{/if}
		{:else}
			<div class="flex items-center justify-center min-h-[50vh]">
				<div class="text-center">
					<p class="text-text-secondary mb-4">Exercise not found</p>
					<Button variant="primary" href="/exercises">Back to Exercises</Button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- PR History Modal -->
<Modal
	open={selectedPR !== null && prHistory.length > 0}
	title="PR History - {getRepRangeLabel(selectedPR?.reps ?? 0)}"
	size="sm"
	onclose={closeHistory}
>
	{#snippet children()}
		{#if prHistory.length > 0}
			<div class="space-y-2">
				{#each prHistory as entry, i}
					<div
						class="flex items-center justify-between p-3 {i === 0
							? 'bg-warning/10 border-2 border-warning'
							: 'bg-surface-elevated'} rounded-lg"
					>
						<div>
							<p class="font-semibold text-text-primary">
								{entry.weight} lbs @ {entry.reps} reps
							</p>
							<p class="text-xs text-text-muted">
								{formatDate(entry.achievedDate)}
							</p>
						</div>
						{#if i === 0}
							<span class="text-xl">🏆</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/snippet}
	{#snippet footer()}
		<Button variant="ghost" fullWidth onclick={closeHistory}>
			Close
		</Button>
	{/snippet}
</Modal>
