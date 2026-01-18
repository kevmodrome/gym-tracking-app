<script lang="ts">
	import { onMount } from 'svelte';
	import { db, liveQuery } from '$lib/db';
	import type { Exercise, Session } from '$lib/types';
	import { getAllPersonalRecords, getPRHistoryForExercise, getRepRangeLabel, calculatePersonalRecords } from '$lib/prUtils';
	import type { PersonalRecord } from '$lib/types';
	import Chart from 'chart.js/auto';
	import zoomPlugin from 'chartjs-plugin-zoom';
	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import XIcon from '$lib/components/XIcon.svelte';
	import ChevronDownIcon from '$lib/components/ChevronDownIcon.svelte';
	import { Button, Card, Modal, ConfirmDialog, Select, TextInput, Textarea, InfoBox, ButtonGroup } from '$lib/ui';

	Chart.register(zoomPlugin);

	// Tab state
	let activeTab = $state<'sessions' | 'charts' | 'records'>('sessions');

	// Shared state
	let exercises = $state<Exercise[]>([]);
	let sessions = $state<Session[]>([]);

	// Sessions tab state
	let allWorkouts = $state<{ id: string; name: string }[]>([]);
	let searchQuery = $state('');
	let selectedWorkout = $state<string>('');
	let dateFilter = $state<'all' | 'week' | 'month' | 'year' | 'custom'>('all');
	let customStartDate = $state('');
	let customEndDate = $state('');
	let currentPage = $state(1);
	let itemsPerPage = $state(10);
	let showSessionDetail = $state<Session | null>(null);
	let showDeleteConfirm = $state(false);
	let showEditModal = $state(false);
	let showUndoToast = $state(false);
	let deletedSession = $state<Session | null>(null);
	let undoTimeout: number | null = null;
	let deleteError = $state<string | null>(null);
	let editForm = $state<{ date: string; name: string; notes: string }>({ date: '', name: '', notes: '' });
	let originalSession = $state<Session | null>(null);
	let saveError = $state<string | null>(null);

	// Charts tab state
	let selectedExercise = $state<Exercise | undefined>(undefined);
	let selectedMetric = $state<'weight' | 'volume' | 'reps'>('weight');
	let chartInstance = $state<Chart | null>(null);
	let chartCanvas = $state<HTMLCanvasElement>();

	// Records tab state
	let allPRs = $state<PersonalRecord[]>([]);
	let selectedExerciseId = $state<string | null>(null);
	let prHistory = $state<any[]>([]);

	const tabOptions = [
		{ value: 'sessions', label: 'Sessions' },
		{ value: 'charts', label: 'Charts' },
		{ value: 'records', label: 'Records' }
	];

	const workoutOptions = $derived([
		{ value: '', label: 'All Workouts' },
		...allWorkouts.map(w => ({ value: w.id, label: w.name }))
	]);

	const dateOptions = [
		{ value: 'all', label: 'All Time' },
		{ value: 'week', label: 'Last 7 Days' },
		{ value: 'month', label: 'Last 30 Days' },
		{ value: 'year', label: 'Last Year' },
		{ value: 'custom', label: 'Custom Range' }
	];

	onMount(async () => {
		exercises = await db.exercises.toArray();
		allWorkouts = (await db.workouts.toArray()).map((w) => ({ id: w.id, name: w.name }));
		allPRs = await getAllPersonalRecords();

		liveQuery(() => db.sessions.orderBy('date').reverse().toArray()).subscribe((data) => {
			sessions = data;
		});
	});

	// Sessions tab logic
	const filteredSessions = $derived.by(() => {
		let filtered = sessions;

		if (selectedWorkout) {
			filtered = filtered.filter((session) => session.workoutId === selectedWorkout);
		}

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

		filtered = filtered.filter((session) => {
			const sessionDate = new Date(session.date);
			return sessionDate >= startDate && sessionDate <= endDate;
		});

		return filtered;
	});

	const paginatedSessions = $derived.by(() => {
		const sliceEnd = currentPage * itemsPerPage;
		return filteredSessions.slice(0, sliceEnd);
	});

	const hasMore = $derived(filteredSessions.length > currentPage * itemsPerPage);

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0) {
			return `${hours}h ${mins}m`;
		}
		return `${mins}m`;
	}

	function getSessionSummary(session: Session): string {
		const exerciseCount = session.exercises.length;
		const completedSets = session.exercises.reduce(
			(acc, ex) => acc + ex.sets.filter((set) => set.completed).length,
			0
		);
		return `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''} · ${completedSets} set${completedSets !== 1 ? 's' : ''}`;
	}

	function clearFilters() {
		searchQuery = '';
		selectedWorkout = '';
		dateFilter = 'all';
		customStartDate = '';
		customEndDate = '';
		currentPage = 1;
	}

	function loadMore() {
		currentPage++;
	}

	async function confirmDelete() {
		if (!showSessionDetail) return;

		try {
			await db.sessions.delete(showSessionDetail.id);
			deletedSession = showSessionDetail;
			showSessionDetail = null;
			showDeleteConfirm = false;
			showUndoToast = true;

			await calculatePersonalRecords();

			if (undoTimeout) clearTimeout(undoTimeout);
			undoTimeout = window.setTimeout(() => {
				showUndoToast = false;
				deletedSession = null;
			}, 30000);
		} catch (error) {
			deleteError = error instanceof Error ? error.message : 'Failed to delete session';
		}
	}

	async function undoDelete() {
		if (!deletedSession) return;

		try {
			await db.sessions.add(deletedSession);
			await calculatePersonalRecords();

			if (undoTimeout) clearTimeout(undoTimeout);
			undoTimeout = null;
			showUndoToast = false;
			deletedSession = null;
		} catch (error) {
			deleteError = error instanceof Error ? error.message : 'Failed to undo deletion';
		}
	}

	function closeDeleteConfirm() {
		showDeleteConfirm = false;
		deleteError = null;
	}

	function openEditModal() {
		if (!showSessionDetail) return;
		originalSession = { ...showSessionDetail };
		const date = new Date(showSessionDetail.date);
		editForm = {
			date: date.toISOString().split('T')[0],
			name: showSessionDetail.workoutName,
			notes: showSessionDetail.notes || ''
		};
		showEditModal = true;
	}

	function closeEditModal() {
		showEditModal = false;
		editForm = { date: '', name: '', notes: '' };
		originalSession = null;
		saveError = null;
	}

	async function saveSessionChanges() {
		if (!showSessionDetail || !editForm.date) {
			saveError = 'Please select a date';
			return;
		}

		try {
			const updatedSession: Session = {
				...showSessionDetail,
				date: new Date(editForm.date).toISOString(),
				workoutName: editForm.name.trim() || showSessionDetail.workoutName,
				notes: editForm.notes.trim() || undefined
			};

			await db.sessions.update(showSessionDetail.id, {
				date: updatedSession.date,
				workoutName: updatedSession.workoutName,
				notes: updatedSession.notes
			});

			showSessionDetail = updatedSession;
			showEditModal = false;
			editForm = { date: '', name: '', notes: '' };
			originalSession = null;
			saveError = null;
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Failed to save changes';
		}
	}

	// Charts tab logic
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
		if (chartCanvas && chartData && activeTab === 'charts') {
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

	// Records tab logic
	async function showHistory(pr: PersonalRecord) {
		selectedExerciseId = pr.exerciseId;
		prHistory = await getPRHistoryForExercise(pr.exerciseId, pr.reps);
	}

	function closeHistory() {
		selectedExerciseId = null;
		prHistory = [];
	}

	function getExerciseName(exerciseId: string): string {
		const exercise = exercises.find((e) => e.id === exerciseId);
		return exercise?.name || 'Unknown Exercise';
	}

	const groupedPRs = $derived.by(() => {
		const groups: Record<string, PersonalRecord[]> = {};

		allPRs.forEach((pr) => {
			if (!groups[pr.exerciseId]) {
				groups[pr.exerciseId] = [];
			}
			groups[pr.exerciseId].push(pr);
		});

		return Object.entries(groups).map(([exerciseId, prs]) => ({
			exerciseId,
			exerciseName: getExerciseName(exerciseId),
			prs: prs.sort((a, b) => a.reps - b.reps)
		}));
	});

	async function refreshPRs() {
		allPRs = await getAllPersonalRecords();
	}
</script>

<svelte:head>
	<title>Progress - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-7xl mx-auto w-full">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
			<h1 class="text-2xl sm:text-3xl font-display font-bold text-text-primary">Progress</h1>
			<ButtonGroup
				options={tabOptions}
				bind:value={activeTab}
				onchange={(v) => activeTab = v as typeof activeTab}
			/>
		</div>

		<!-- Sessions Tab -->
		{#if activeTab === 'sessions'}
			<Card class="mb-6">
				{#snippet children()}
					<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
						<div class="relative">
							<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Search workouts..."
								class="w-full pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary placeholder:text-text-muted text-sm sm:text-base min-h-[44px]"
							/>
						</div>

						<Select
							label="Workout Type"
							bind:value={selectedWorkout}
							options={workoutOptions}
						/>

						<Select
							label="Date Range"
							bind:value={dateFilter}
							options={dateOptions}
						/>

						<div>
							<label class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
								Showing: {filteredSessions.length} sessions
							</label>
							<Button variant="ghost" onclick={clearFilters} fullWidth>
								<XIcon class="w-4 h-4" />
								Clear
							</Button>
						</div>
					</div>

					{#if dateFilter === 'custom'}
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4 pt-4 border-t border-border">
							<div>
								<label for="start-date" class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">Start Date</label>
								<input
									id="start-date"
									type="date"
									bind:value={customStartDate}
									class="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm text-text-primary min-h-[44px]"
								/>
							</div>
							<div>
								<label for="end-date" class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">End Date</label>
								<input
									id="end-date"
									type="date"
									bind:value={customEndDate}
									class="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm text-text-primary min-h-[44px]"
								/>
							</div>
						</div>
					{/if}
				{/snippet}
			</Card>

			{#if filteredSessions.length === 0}
				<Card class="text-center" padding="lg">
					{#snippet children()}
						<div class="text-text-muted mb-4">
							<SearchIcon class="w-16 h-16 mx-auto" />
						</div>
						<h2 class="text-xl font-semibold text-text-primary mb-2">No workout sessions found</h2>
						<p class="text-text-secondary">
							{#if sessions.length === 0}
								Start working out to see your history here
							{:else}
								Try adjusting your search or filters
							{/if}
						</p>
					{/snippet}
				</Card>
			{:else}
				<div class="grid grid-cols-1 gap-4">
					{#each paginatedSessions as session}
						<Card hoverable>
							{#snippet children()}
								<button
									class="w-full text-left"
									onclick={() => (showSessionDetail = session)}
									type="button"
								>
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<h3 class="text-xl font-semibold text-text-primary mb-2">{session.workoutName}</h3>
											<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
												<div class="flex items-center gap-2">
													<span class="text-text-muted">📅</span>
													<span class="text-sm text-text-secondary">{formatDate(session.date)}</span>
												</div>
												<div class="flex items-center gap-2">
													<span class="text-text-muted">⏱️</span>
													<span class="text-sm text-text-secondary">{formatDuration(session.duration)}</span>
												</div>
												<div class="flex items-center gap-2">
													<span class="text-text-muted">💪</span>
													<span class="text-sm text-text-secondary">{getSessionSummary(session)}</span>
												</div>
											</div>
											{#if session.notes}
												<p class="text-sm text-text-secondary mt-2 bg-surface-elevated p-2 rounded">
													{session.notes}
												</p>
											{/if}
										</div>
										<div class="flex items-center gap-2 ml-4">
											<ChevronDownIcon class="w-5 h-5 text-text-muted" />
										</div>
									</div>
								</button>
							{/snippet}
						</Card>
					{/each}
				</div>

				{#if hasMore}
					<div class="mt-6 text-center">
						<Button variant="primary" onclick={loadMore}>
							Load More Sessions
						</Button>
					</div>
				{/if}
			{/if}
		{/if}

		<!-- Charts Tab -->
		{#if activeTab === 'charts'}
			<div class="bg-surface rounded-xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
					<div>
						<label for="exercise-select" class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
							Select Exercise
						</label>
						<select
							id="exercise-select"
							onchange={handleExerciseChange}
							class="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary text-sm min-h-[44px]"
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
							<label for="metric-select" class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
								Metric
							</label>
							<select
								id="metric-select"
								bind:value={selectedMetric}
								class="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary text-sm min-h-[44px]"
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
		{/if}

		<!-- Records Tab -->
		{#if activeTab === 'records'}
			<div class="flex justify-end mb-4">
				<Button onclick={refreshPRs}>
					Refresh
				</Button>
			</div>

			{#if allPRs.length === 0}
				<Card class="text-center" padding="lg">
					{#snippet children()}
						<div class="text-4xl sm:text-6xl mb-3 sm:mb-4 text-warning drop-shadow-[0_0_20px_rgba(255,149,0,0.5)]">🏆</div>
						<h2 class="text-xl sm:text-2xl font-bold text-text-primary mb-2">No Personal Records Yet</h2>
						<p class="text-sm sm:text-base text-text-secondary">
							Start logging your workouts to track your personal records!
						</p>
					{/snippet}
				</Card>
			{:else}
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
					{#each groupedPRs as group}
						<Card>
							{#snippet children()}
								<h2 class="text-lg sm:text-xl font-bold text-text-primary mb-3 sm:mb-4">{group.exerciseName}</h2>
								<div class="space-y-2 sm:space-y-3">
									{#each group.prs as pr}
										<div
											class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-3 bg-gradient-to-r from-warning/10 to-warning/5 rounded-lg border border-warning/30"
										>
											<div class="flex items-center gap-2 sm:gap-3">
												<div class="w-9 h-9 sm:w-10 sm:h-10 bg-warning text-bg rounded-full flex items-center justify-center font-bold flex-shrink-0 shadow-[0_0_15px_rgba(255,149,0,0.4)]">
													🏆
												</div>
												<div>
													<p class="font-semibold text-text-primary text-sm sm:text-base">
														{getRepRangeLabel(pr.reps)}: {pr.weight} lbs
													</p>
													<p class="text-xs sm:text-sm text-text-muted">
														{new Date(pr.achievedDate).toLocaleDateString()}
													</p>
												</div>
											</div>
											<Button
												variant="ghost"
												size="sm"
												onclick={() => showHistory(pr)}
												class="self-start sm:self-auto bg-secondary/20 text-secondary hover:bg-secondary/30"
											>
												View History
											</Button>
										</div>
									{/each}
								</div>
							{/snippet}
						</Card>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Session Detail Modal -->
<Modal
	open={showSessionDetail !== null}
	title={showSessionDetail?.workoutName || ''}
	size="xl"
	onclose={() => (showSessionDetail = null)}
>
	{#snippet children()}
		{#if showSessionDetail}
			<div class="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-4">
				<p class="text-sm text-text-secondary">{formatDate(showSessionDetail.date)}</p>
				<div class="flex items-center gap-2 sm:gap-4">
					<div class="text-right">
						<p class="text-xs sm:text-sm text-text-muted">Duration</p>
						<p class="text-base sm:text-lg font-semibold text-text-primary">{formatDuration(showSessionDetail.duration)}</p>
					</div>
					<Button variant="primary" size="sm" onclick={openEditModal}>
						Edit
					</Button>
					<Button variant="danger" size="sm" onclick={() => (showDeleteConfirm = true)}>
						Delete
					</Button>
				</div>
			</div>

			{#if showSessionDetail.notes}
				<InfoBox type="info" class="mb-4">
					<h3 class="font-semibold mb-2 text-sm sm:text-base">Notes</h3>
					<p class="text-sm sm:text-base">{showSessionDetail.notes}</p>
				</InfoBox>
			{/if}

			<div class="space-y-3 sm:space-y-4">
				{#each showSessionDetail.exercises as exercise}
					<div class="border border-border rounded-lg overflow-hidden">
						<div class="bg-surface-elevated px-3 sm:px-4 py-2 sm:py-3 border-b border-border">
							<h4 class="font-semibold text-text-primary text-base sm:text-lg">{exercise.exerciseName}</h4>
							<p class="text-xs sm:text-sm text-text-secondary capitalize">{exercise.primaryMuscle}</p>
						</div>

						<div class="p-3 sm:p-4">
							<div class="hidden sm:block">
								<table class="w-full">
									<thead>
										<tr class="border-b border-border">
											<th class="text-left py-2 text-sm font-medium text-text-secondary">Set</th>
											<th class="text-left py-2 text-sm font-medium text-text-secondary">Reps</th>
											<th class="text-left py-2 text-sm font-medium text-text-secondary">Weight</th>
											<th class="text-left py-2 text-sm font-medium text-text-secondary">Status</th>
										</tr>
									</thead>
									<tbody>
										{#each exercise.sets as set, idx}
											<tr class={set.completed ? 'bg-success/5' : ''}>
												<td class="py-2 text-sm text-text-secondary">{idx + 1}</td>
												<td class="py-2 text-sm text-text-secondary">{set.reps}</td>
												<td class="py-2 text-sm text-text-secondary">{set.weight} lbs</td>
												<td class="py-2 text-sm">
													<span
														class="px-2 py-1 rounded-full text-xs font-medium {set.completed
															? 'bg-success/20 text-success'
															: 'bg-surface-elevated text-text-muted'}"
													>
														{set.completed ? '✓ Completed' : '— Skipped'}
													</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>

							<div class="sm:hidden space-y-2">
								{#each exercise.sets as set, idx}
									<div class="flex items-center justify-between p-3 border border-border rounded-lg {set.completed ? 'bg-success/10' : 'bg-surface-elevated'}">
										<div class="flex items-center gap-3">
											<span class="w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium {set.completed ? 'bg-success text-bg' : 'bg-surface text-text-muted'}">{idx + 1}</span>
											<div>
												<p class="text-sm font-medium text-text-primary">{set.reps} reps × {set.weight} lbs</p>
											</div>
										</div>
										<span class="text-xs font-medium px-2 py-1 rounded-full {set.completed ? 'bg-success/20 text-success' : 'bg-surface text-text-muted'}">
											{set.completed ? 'Done' : 'Skip'}
										</span>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/snippet}
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (showSessionDetail = null)} fullWidth>
			Close
		</Button>
	{/snippet}
</Modal>

<!-- Delete Confirmation -->
<ConfirmDialog
	open={showDeleteConfirm}
	title="Delete Workout"
	message={'This will permanently delete "' + (showSessionDetail?.workoutName || '') + '" from ' + formatDate(showSessionDetail?.date || '') + '. This action cannot be undone.'}
	confirmText="Delete Workout"
	confirmVariant="danger"
	onconfirm={confirmDelete}
	oncancel={closeDeleteConfirm}
/>

<!-- Edit Modal -->
<Modal
	open={showEditModal}
	title="Edit Workout"
	size="sm"
	onclose={closeEditModal}
>
	{#snippet children()}
		<div class="space-y-4">
			<div>
				<label for="edit-date" class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">Date</label>
				<input
					id="edit-date"
					type="date"
					bind:value={editForm.date}
					required
					class="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm text-text-primary min-h-[44px]"
				/>
			</div>

			<TextInput
				label="Workout Name"
				bind:value={editForm.name}
				placeholder="Workout name"
			/>

			<Textarea
				label="Notes"
				bind:value={editForm.notes}
				placeholder="Add notes about your workout..."
				rows={3}
			/>

			{#if saveError}
				<InfoBox type="error">
					<p class="text-sm">{saveError}</p>
				</InfoBox>
			{/if}
		</div>
	{/snippet}
	{#snippet footer()}
		<Button variant="ghost" onclick={closeEditModal}>
			Cancel
		</Button>
		<Button variant="primary" onclick={saveSessionChanges}>
			Save Changes
		</Button>
	{/snippet}
</Modal>

<!-- PR History Modal -->
<Modal
	open={selectedExerciseId !== null && prHistory.length > 0}
	title="PR History - {selectedExerciseId ? getExerciseName(selectedExerciseId) : ''}"
	size="sm"
	onclose={closeHistory}
>
	{#snippet children()}
		{#if prHistory.length > 0}
			<div class="space-y-2 sm:space-y-3">
				{#each prHistory as entry, i}
					<div
						class="flex items-center justify-between p-3 {i === 0
							? 'bg-warning/10 border-2 border-warning'
							: 'bg-surface-elevated'} rounded-lg"
					>
						<div>
							<p class="font-semibold text-text-primary text-sm sm:text-base">
								{entry.weight} lbs @ {entry.reps} reps
							</p>
							<p class="text-xs sm:text-sm text-text-muted">
								{new Date(entry.achievedDate).toLocaleDateString()}
							</p>
						</div>
						{#if i === 0}
							<span class="text-xl sm:text-2xl drop-shadow-[0_0_10px_rgba(255,149,0,0.5)]">🏆</span>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-text-muted text-center py-8 text-sm sm:text-base">No history available for this rep range</p>
		{/if}
	{/snippet}
	{#snippet footer()}
		<Button variant="ghost" fullWidth onclick={closeHistory}>
			Close
		</Button>
	{/snippet}
</Modal>

<!-- Undo Toast -->
{#if showUndoToast}
	<div class="fixed bottom-4 right-4 bg-surface border border-warning/30 rounded-lg shadow-xl p-4 max-w-md z-[70] flex items-start gap-3">
		<div class="flex-1">
			<p class="font-medium text-text-primary mb-1">Workout deleted</p>
			<p class="text-sm text-text-secondary mb-2">
				"{deletedSession?.workoutName}" has been removed from your history.
			</p>
			<Button variant="primary" size="sm" onclick={undoDelete}>
				Undo
			</Button>
		</div>
		<button
			onclick={() => {
				showUndoToast = false;
				if (undoTimeout) clearTimeout(undoTimeout);
				undoTimeout = null;
				deletedSession = null;
			}}
			class="text-text-muted hover:text-text-primary"
			type="button"
		>
			<XIcon class="w-5 h-5" />
		</button>
	</div>
{/if}
