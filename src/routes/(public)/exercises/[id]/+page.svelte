<script lang="ts">
	import { getPRHistoryForExercise, getRepRangeLabel } from '$lib/prUtils';
	import type { PersonalRecord } from '$lib/types';
	import { Plot, Line, Dot } from 'svelteplot';
	import { Button, Card, Modal, Select } from '$lib/ui';
	import { ArrowLeft } from 'lucide-svelte';
	import { preferencesStore } from '$lib/stores/preferences.svelte';

	let { data } = $props();

	// Destructure data for easier access
	const exercise = $derived(data.exercise);
	const sessions = $derived(data.sessions);
	const personalRecords = $derived(data.personalRecords);
	const exerciseId = $derived(data.exerciseId);

	let selectedMetric = $state<'weight' | 'volume' | 'reps'>('weight');
	let selectedPR = $state<PersonalRecord | null>(null);
	let prHistory = $state<any[]>([]);

	const exerciseSessions = $derived.by(() => {
		return [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	});

	const chartData = $derived.by(() => {
		if (exerciseSessions.length === 0) return null;

		const dataPoints = exerciseSessions
			.map((session) => {
				const exerciseInSession = session.exercises.find((ex) => ex.exerciseId === exerciseId);
				if (!exerciseInSession || exerciseInSession.sets.length === 0) return null;

				if (selectedMetric === 'weight') {
					const maxWeight = Math.max(...exerciseInSession.sets.map((set) => set.weight));
					return { date: new Date(session.date), value: maxWeight };
				} else if (selectedMetric === 'volume') {
					const totalVolume = exerciseInSession.sets.reduce(
						(sum, set) => sum + (set.completed ? set.weight * set.reps : 0),
						0
					);
					return { date: new Date(session.date), value: totalVolume };
				} else {
					const maxReps = Math.max(...exerciseInSession.sets.map((set) => set.reps));
					return { date: new Date(session.date), value: maxReps };
				}
			})
			.filter((point): point is { date: Date; value: number } => point !== null);

		return dataPoints;
	});

	const trendData = $derived.by(() => {
		if (!chartData || chartData.length < 2) return null;

		const values = chartData.map((d) => d.value);
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

		const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
		const intercept = (sumY - slope * sumX) / n;

		return chartData.map((d, i) => ({
			date: d.date,
			value: slope * i + intercept
		}));
	});

	function getMetricLabel(): string {
		switch (selectedMetric) {
			case 'weight':
				return 'Weight (' + preferencesStore.weightLabel + ')';
			case 'volume':
				return 'Volume (' + preferencesStore.weightLabel + ')';
			case 'reps':
				return 'Max Reps';
		}
	}

	function getMetricUnit(): string {
		switch (selectedMetric) {
			case 'weight':
				return ' ' + preferencesStore.weightLabel;
			case 'volume':
				return ' ' + preferencesStore.weightLabel;
			case 'reps':
				return ' reps';
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

	const metricOptions = $derived([
		{ value: 'weight', label: `Weight (${preferencesStore.weightLabel})` },
		{ value: 'volume', label: `Volume (${preferencesStore.weightLabel} × reps)` },
		{ value: 'reps', label: 'Max Reps' }
	]);
</script>

<svelte:head>
	<title>{exercise?.name ?? 'Exercise'} - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-4xl mx-auto w-full">
		{#if exercise}
			<!-- Header -->
			<div class="flex items-center gap-4 mb-6">
				<Button variant="ghost" href="/exercises">
					<ArrowLeft class="w-5 h-5" />
				</Button>
				<div class="flex-1">
					<div class="flex items-center gap-3">
						<h1 class="text-2xl sm:text-3xl font-bold font-display text-text-primary">
							{exercise.name}
						</h1>
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
					{#if exercise}
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
							<div>
								<p class="text-xs text-text-muted mb-1">Category</p>
								<p class="text-sm font-medium text-text-primary capitalize">{exercise.category}</p>
							</div>
							<div>
								<p class="text-xs text-text-muted mb-1">Primary Muscle</p>
								<p class="text-sm font-medium text-text-primary capitalize">
									{exercise.primary_muscle}
								</p>
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
										<span
											class="text-xs bg-surface-elevated text-text-secondary px-2 py-1 rounded capitalize"
										>
											{muscle}
										</span>
									{/each}
								</div>
							</div>
						{/if}
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
									<div
										class="w-10 h-10 bg-warning text-bg rounded-full flex items-center justify-center font-bold flex-shrink-0 shadow-[0_0_15px_rgba(255,149,0,0.4)]"
									>
										🏆
									</div>
									<div class="flex-1 min-w-0">
										<p class="font-semibold text-text-primary text-sm">
											{getRepRangeLabel(pr.reps)}: {pr.weight} {preferencesStore.weightLabel}
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
								options={metricOptions}
							/>
						</div>
					</div>

					{#if exerciseSessions.length === 0}
						<div class="text-center py-8">
							<p class="text-text-secondary">
								No session data yet. Start working out to see your progress!
							</p>
						</div>
					{:else}
						<div class="h-64 sm:h-80">
							{#if chartData && chartData.length > 0}
								<Plot height={320} marginLeft={60} marginBottom={50} grid>
									{#if trendData}
										<Line
											data={trendData}
											x="date"
											y="value"
											stroke="#7c5cff"
											strokeWidth={2}
											strokeDasharray="5,5"
										/>
									{/if}
									<Line data={chartData} x="date" y="value" stroke="#c5ff00" strokeWidth={2} />
									<Dot data={chartData} x="date" y="value" fill="#c5ff00" r={6} />
								</Plot>
							{/if}
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
										{Math.max(...chartData.map((d) => d.value))}{getMetricUnit()}
									</p>
								</div>
								<div class="bg-secondary/10 rounded-lg p-3">
									<p class="text-xs text-secondary font-medium mb-1">Average</p>
									<p class="text-lg font-bold text-secondary">
										{Math.round(
											chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length
										)}{getMetricUnit()}
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
								{@const exerciseData = session.exercises.find((e) => e.exerciseId === exerciseId)}
								{#if exerciseData}
									<div class="p-3 bg-surface-elevated rounded-lg border border-border">
										<div class="flex items-center justify-between mb-2">
											<p class="font-medium text-text-primary">{formatDate(session.date)}</p>
											<p class="text-xs text-text-muted">{session.duration} min</p>
										</div>
										<div class="flex flex-wrap gap-2">
											{#each exerciseData.sets as set, idx}
												<span
													class="text-xs px-2 py-1 rounded {set.completed
														? 'bg-success/20 text-success'
														: 'bg-surface text-text-muted'}"
												>
													{set.reps} × {set.weight}{preferencesStore.weightLabel}
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
								{entry.weight} {preferencesStore.weightLabel} @ {entry.reps} reps
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
