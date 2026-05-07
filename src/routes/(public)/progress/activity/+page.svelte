<script lang="ts">
	import { fly } from 'svelte/transition';
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import type { Session, SessionExercise } from '$lib/types';
	import { volumeWeight } from '$lib/types';
	import { calculatePersonalRecords } from '$lib/prUtils';
	import {
		calculateDailyMetrics,
		calculateVolumeTrendsForChart,
		calculateLinearRegression,
		calculateStreakDays,
		calculateTotalVolume,
		type VolumeScale
	} from '$lib/dashboardMetrics';
	import { getDateRange } from '$lib/dateUtils';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import { formatSetWeight } from '$lib/formatUtils';
	import { Plot, Line, Dot } from 'svelteplot';
	import {
		Search,
		X,
		ChevronDown,
		Calendar,
		Timer,
		Dumbbell,
		Check,
		Activity as ActivityIcon
	} from 'lucide-svelte';
	import {
		Button,
		ButtonGroup,
		Card,
		Modal,
		ConfirmDialog,
		Select,
		TextInput,
		Textarea,
		InfoBox,
		SearchInput,
		NumberSpinner,
		Numeric,
		EmptyState
	} from '$lib/ui';

	const sessionsCol = db.collection('sessions');
	let sessions = $state<Session[]>([]);

	$effect(() => {
		sessionsCol
			.orderBy('date')
			.reverse()
			.get()
			.then((data) => {
				sessions = data as Session[];
			});
	});

	// ---------- Hero metrics ----------
	const totalSessions = $derived(sessions.length);
	const totalVolume = $derived(calculateTotalVolume(sessions));
	const streakDays = $derived(calculateStreakDays(sessions));

	// ---------- Heat map ----------
	let heatmapWindow = $state<180 | 365>(180);
	const heatmapData = $derived(calculateDailyMetrics(sessions, heatmapWindow));

	const heatmapMaxVolume = $derived.by(() => {
		const max = heatmapData.reduce((m, d) => Math.max(m, d.volume), 0);
		return max > 0 ? max : 1;
	});

	// Group days into weeks (columns), Sunday-first
	const heatmapWeeks = $derived.by(() => {
		if (heatmapData.length === 0) return [];
		const cells: Array<{ date: string; sessionCount: number; volume: number }> = [];
		// Pad start so first column begins on a Sunday
		const first = new Date(heatmapData[0].date);
		const firstDow = first.getDay();
		for (let i = 0; i < firstDow; i++) {
			cells.push({ date: '', sessionCount: 0, volume: 0 });
		}
		for (const d of heatmapData) cells.push(d);
		const weeks: Array<typeof cells> = [];
		for (let i = 0; i < cells.length; i += 7) {
			weeks.push(cells.slice(i, i + 7));
		}
		return weeks;
	});

	function intensityClass(volume: number, sessionCount: number): string {
		if (sessionCount === 0) return 'bg-surface-elevated border-border';
		const ratio = volume / heatmapMaxVolume;
		if (ratio > 0.66) return 'bg-accent border-accent shadow-[0_0_8px_var(--color-accent-glow)]';
		if (ratio > 0.33) return 'bg-accent/60 border-accent/40';
		if (ratio > 0) return 'bg-accent/35 border-accent/25';
		return 'bg-accent/20 border-accent/15';
	}

	function formatHeatmapTitle(date: string, sessionCount: number, volume: number): string {
		if (!date) return '';
		const d = new Date(date);
		const dateStr = d.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
		if (sessionCount === 0) return `${dateStr} — no sessions`;
		const vol = Math.round(volume);
		return `${dateStr} — ${sessionCount} session${sessionCount !== 1 ? 's' : ''}, ${vol} ${preferencesStore.weightLabel} volume`;
	}

	// ---------- Volume trend chart ----------
	let volumeScale = $state<VolumeScale>('week');
	const volumePoints = $derived.by(() => {
		const maxPoints = volumeScale === 'day' ? 30 : 12;
		const trends = calculateVolumeTrendsForChart(sessions, volumeScale, maxPoints);
		return trends.map((t) => ({ date: t.rawDate, value: t.volume }));
	});

	const volumeTrendLine = $derived(calculateLinearRegression(volumePoints));

	const volumeScaleOptions = [
		{ value: 'day', label: 'Day' },
		{ value: 'week', label: 'Week' },
		{ value: 'month', label: 'Month' }
	];

	// ---------- Session list (logic preserved from old /sessions page) ----------
	function getSessionMuscleGroups(session: Session): string[] {
		const muscles = new Set<string>();
		for (const exercise of session.exercises) {
			if (exercise.primaryMuscle) muscles.add(exercise.primaryMuscle);
		}
		return Array.from(muscles);
	}

	function getSessionExerciseNames(session: Session): string {
		if (session.exercises.length === 0) return 'Session';
		return session.exercises.map((e) => e.exerciseName).join(', ');
	}

	function getFormattedMuscleGroups(session: Session): string {
		const muscles = getSessionMuscleGroups(session);
		if (muscles.length === 0) return '';
		return muscles.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
	}

	let searchQuery = $state('');
	let dateFilter = $state<'all' | 'week' | 'month' | 'year' | 'custom'>('all');
	let customStartDate = $state('');
	let customEndDate = $state('');
	let currentPage = $state(1);
	const itemsPerPage = 10;
	let showSessionDetail = $state<Session | null>(null);
	let showDeleteConfirm = $state(false);
	let showUndoToast = $state(false);
	let deletedSession = $state<Session | null>(null);
	let undoTimeout: number | null = null;
	let deleteError = $state<string | null>(null);
	let saveError = $state<string | null>(null);

	let isEditMode = $state(false);
	let editingExercises = $state<SessionExercise[]>([]);
	let editingSessionNotes = $state('');
	let editingSessionDate = $state('');

	const dateOptions = [
		{ value: 'all', label: 'All Time' },
		{ value: 'week', label: 'Last 7 Days' },
		{ value: 'month', label: 'Last 30 Days' },
		{ value: 'year', label: 'Last Year' },
		{ value: 'custom', label: 'Custom Range' }
	];

	const filteredSessions = $derived.by(() => {
		let filtered = sessions;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			filtered = filtered.filter((session) => {
				const matchesExercise = session.exercises.some((e) =>
					e.exerciseName.toLowerCase().includes(q)
				);
				const matchesMuscle = getSessionMuscleGroups(session).some((m) =>
					m.toLowerCase().includes(q)
				);
				return matchesExercise || matchesMuscle;
			});
		}
		if (dateFilter !== 'all') {
			const { startDate, endDate } = getDateRange(dateFilter, customStartDate, customEndDate);
			filtered = filtered.filter((session) => {
				const sd = new Date(session.date);
				return sd >= startDate && sd <= endDate;
			});
		}
		return filtered;
	});

	const paginatedSessions = $derived(filteredSessions.slice(0, currentPage * itemsPerPage));
	const hasMore = $derived(filteredSessions.length > currentPage * itemsPerPage);

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatDuration(minutes: number): string {
		const h = Math.floor(minutes / 60);
		const m = Math.round(minutes % 60);
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
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
			const sessionToDelete = showSessionDetail;
			await db.collection('sessions').delete(sessionToDelete.id);
			deletedSession = sessionToDelete;
			showDeleteConfirm = false;
			showSessionDetail = null;
			showUndoToast = true;
			await tick();
			await new Promise((r) => setTimeout(r, 200));
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
			await db.collection('sessions').add({
				exercises: $state.snapshot(deletedSession.exercises),
				date: deletedSession.date,
				duration: deletedSession.duration,
				notes: deletedSession.notes,
				createdAt: deletedSession.createdAt,
				status: 'completed'
			});
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

	function rerunSession(session: Session) {
		const newSessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
		goto(`/session/${newSessionId}?from=${session.id}`);
	}

	function openDeleteConfirmForSession(session: Session) {
		showSessionDetail = session;
		showDeleteConfirm = true;
	}

	function enterEditMode() {
		if (!showSessionDetail) return;
		editingExercises = JSON.parse(JSON.stringify(showSessionDetail.exercises));
		editingSessionNotes = showSessionDetail.notes || '';
		editingSessionDate = new Date(showSessionDetail.date).toISOString().split('T')[0];
		isEditMode = true;
	}

	function cancelEditMode() {
		isEditMode = false;
		editingExercises = [];
		editingSessionNotes = '';
		editingSessionDate = '';
	}

	async function saveSessionEdits() {
		if (!showSessionDetail || !editingSessionDate) return;
		try {
			const updatedSession: Session = {
				...showSessionDetail,
				exercises: editingExercises,
				notes: editingSessionNotes.trim() || undefined,
				date: new Date(editingSessionDate).toISOString()
			};
			await db.collection('sessions').update(showSessionDetail.id, {
				exercises: $state.snapshot(updatedSession.exercises),
				notes: updatedSession.notes,
				date: updatedSession.date
			});
			await calculatePersonalRecords();
			showSessionDetail = updatedSession;
			isEditMode = false;
			editingExercises = [];
			editingSessionNotes = '';
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Failed to save changes';
		}
	}

	function updateSetValue(
		exerciseIndex: number,
		setIndex: number,
		field: 'reps' | 'weight',
		value: number
	) {
		editingExercises[exerciseIndex].sets[setIndex][field] = value;
	}

	function updateSetNotes(exerciseIndex: number, setIndex: number, notes: string) {
		editingExercises[exerciseIndex].sets[setIndex].notes = notes || undefined;
	}

	function toggleSetCompleted(exerciseIndex: number, setIndex: number) {
		editingExercises[exerciseIndex].sets[setIndex].completed =
			!editingExercises[exerciseIndex].sets[setIndex].completed;
	}

	function updateExerciseNotes(exerciseIndex: number, notes: string) {
		editingExercises[exerciseIndex].notes = notes || undefined;
	}
</script>

{#if sessions.length === 0}
	<Card padding="lg">
		{#snippet children()}
			<EmptyState
				title="No activity yet"
				description="Finish a workout to see your training calendar, volume trends, and session history here."
				actionLabel="Start a session"
				actionHref="/train"
			>
				{#snippet icon()}<ActivityIcon />{/snippet}
			</EmptyState>
		{/snippet}
	</Card>
{:else}
	<!-- Hero metrics -->
	<section class="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
		<Card padding="md">
			{#snippet children()}
				<p class="text-xs sm:text-sm text-text-secondary mb-1">Sessions</p>
				<Numeric value={totalSessions} size="hero" tone="default" />
			{/snippet}
		</Card>
		<Card padding="md">
			{#snippet children()}
				<p class="text-xs sm:text-sm text-text-secondary mb-1">
					Volume ({preferencesStore.weightLabel})
				</p>
				<Numeric value={Math.round(totalVolume).toLocaleString()} size="hero" tone="default" />
			{/snippet}
		</Card>
		<Card padding="md">
			{#snippet children()}
				<p class="text-xs sm:text-sm text-text-secondary mb-1">Streak</p>
				<Numeric value={streakDays} size="hero" tone="streak" unit="d" />
			{/snippet}
		</Card>
	</section>

	<!-- Heat map -->
	<section class="mb-6">
		<Card>
			{#snippet children()}
				<div class="flex items-center justify-between mb-4 flex-wrap gap-2">
					<h2 class="font-display font-bold text-lg text-text-primary">Training calendar</h2>
					<ButtonGroup
						options={[
							{ value: '180', label: '6m' },
							{ value: '365', label: '12m' }
						]}
						value={String(heatmapWindow)}
						onchange={(v) => (heatmapWindow = Number(v) as 180 | 365)}
					/>
				</div>

				<div class="overflow-x-auto pb-1">
					<div class="flex gap-[3px] min-w-max">
						{#each heatmapWeeks as week, wi (wi)}
							<div class="flex flex-col gap-[3px]">
								{#each week as cell, ci (`${wi}-${ci}`)}
									{#if cell.date}
										<div
											class="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm border {intensityClass(
												cell.volume,
												cell.sessionCount
											)}"
											title={formatHeatmapTitle(cell.date, cell.sessionCount, cell.volume)}
										></div>
									{:else}
										<div class="w-2.5 h-2.5 sm:w-3 sm:h-3"></div>
									{/if}
								{/each}
							</div>
						{/each}
					</div>
				</div>

				<div class="mt-3 flex items-center gap-2 text-xs text-text-muted">
					<span>Less</span>
					<span class="w-2.5 h-2.5 rounded-sm border bg-surface-elevated border-border"></span>
					<span class="w-2.5 h-2.5 rounded-sm border bg-accent/35 border-accent/25"></span>
					<span class="w-2.5 h-2.5 rounded-sm border bg-accent/60 border-accent/40"></span>
					<span class="w-2.5 h-2.5 rounded-sm border bg-accent border-accent"></span>
					<span>More</span>
				</div>
			{/snippet}
		</Card>
	</section>

	<!-- Volume trend chart -->
	<section class="mb-6">
		<Card>
			{#snippet children()}
				<div class="flex items-center justify-between mb-4 flex-wrap gap-2">
					<h2 class="font-display font-bold text-lg text-text-primary">Volume trend</h2>
					<ButtonGroup
						options={volumeScaleOptions}
						value={volumeScale}
						onchange={(v) => (volumeScale = v as VolumeScale)}
					/>
				</div>

				{#if volumePoints.length === 0}
					<p class="text-sm text-text-secondary text-center py-8">
						Not enough data for this scale yet.
					</p>
				{:else}
					<div class="h-64 sm:h-72">
						<Plot height={280} marginLeft={56} marginBottom={40} grid>
							{#if volumeTrendLine}
								<Line
									data={volumeTrendLine}
									x="date"
									y="value"
									stroke="var(--color-secondary)"
									strokeWidth={2}
									strokeDasharray="5,5"
								/>
							{/if}
							<Line
								data={volumePoints}
								x="date"
								y="value"
								stroke="var(--color-focal)"
								strokeWidth={2}
							/>
							<Dot data={volumePoints} x="date" y="value" fill="var(--color-focal)" r={4} />
						</Plot>
					</div>
				{/if}
			{/snippet}
		</Card>
	</section>

	<!-- Session list -->
	<section>
		<Card class="mb-4">
			{#snippet children()}
				<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
					<SearchInput
						label="Search"
						bind:value={searchQuery}
						placeholder="Search exercises or muscle groups..."
					/>
					<Select label="Date Range" bind:value={dateFilter} options={dateOptions} />
					<div>
						<span class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
							Showing: {filteredSessions.length} sessions
						</span>
						<Button variant="ghost" onclick={clearFilters} fullWidth>
							<X class="w-4 h-4" />
							Clear
						</Button>
					</div>
				</div>

				{#if dateFilter === 'custom'}
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4 pt-4 border-t border-border">
						<div>
							<label
								for="start-date"
								class="block text-xs sm:text-sm font-medium text-text-secondary mb-1"
							>
								Start Date
							</label>
							<input
								id="start-date"
								type="date"
								bind:value={customStartDate}
								class="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm text-text-primary min-h-[44px]"
							/>
						</div>
						<div>
							<label
								for="end-date"
								class="block text-xs sm:text-sm font-medium text-text-secondary mb-1"
							>
								End Date
							</label>
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
			<Card padding="lg">
				{#snippet children()}
					<EmptyState
						title="No sessions match"
						description={sessions.length === 0
							? 'Start working out to see your history here.'
							: 'Try adjusting your search or filters.'}
					>
						{#snippet icon()}<Search />{/snippet}
					</EmptyState>
				{/snippet}
			</Card>
		{:else}
			<div class="grid grid-cols-1 gap-4">
				{#each paginatedSessions as session (session.id)}
					<Card hoverable>
						{#snippet children()}
							<button
								class="w-full text-left"
								onclick={() => (showSessionDetail = session)}
								type="button"
							>
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<h3 class="text-lg font-semibold text-text-primary mb-1">
											{getSessionExerciseNames(session)}
										</h3>
										{#if getFormattedMuscleGroups(session)}
											<p class="text-sm text-text-muted mb-2">
												({getFormattedMuscleGroups(session)})
											</p>
										{/if}
										<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
											<div class="flex items-center gap-2">
												<Calendar class="w-4 h-4 text-text-muted" />
												<span class="text-sm text-text-secondary">{formatDate(session.date)}</span>
											</div>
											<div class="flex items-center gap-2">
												<Timer class="w-4 h-4 text-text-muted" />
												<span class="text-sm text-text-secondary"
													>{formatDuration(session.duration)}</span
												>
											</div>
											<div class="flex items-center gap-2">
												<Dumbbell class="w-4 h-4 text-text-muted" />
												<span class="text-sm text-text-secondary"
													>{getSessionSummary(session)}</span
												>
											</div>
										</div>
										{#if session.notes}
											<p class="text-sm text-text-secondary mt-2 bg-surface-elevated p-2 rounded">
												{session.notes}
											</p>
										{/if}
									</div>
									<div class="flex items-center gap-2 ml-4">
										<ChevronDown class="w-5 h-5 text-text-muted" />
									</div>
								</div>
							</button>
							<div class="flex items-center gap-2 mt-4 pt-4 border-t border-border">
								<Button variant="success" size="sm" onclick={() => rerunSession(session)}>
									Re-run
								</Button>
								<Button
									variant="danger"
									size="sm"
									onclick={() => openDeleteConfirmForSession(session)}
								>
									Delete
								</Button>
							</div>
						{/snippet}
					</Card>
				{/each}
			</div>

			{#if hasMore}
				<div class="mt-6 text-center">
					<Button variant="primary" onclick={loadMore}>Load More Sessions</Button>
				</div>
			{/if}
		{/if}
	</section>
{/if}

<!-- Session Detail Modal -->
<Modal
	open={showSessionDetail !== null}
	title={showSessionDetail ? getSessionExerciseNames(showSessionDetail) : ''}
	size="xl"
	fullScreenMobile
	onclose={() => {
		showSessionDetail = null;
		cancelEditMode();
	}}
>
	{#snippet children()}
		{#if showSessionDetail}
			<div class="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-4">
				<p class="text-sm text-text-secondary">{formatDate(showSessionDetail.date)}</p>
				<div class="text-right">
					<p class="text-xs sm:text-sm text-text-muted">Duration</p>
					<p class="text-base sm:text-lg font-semibold text-text-primary">
						{formatDuration(showSessionDetail.duration)}
					</p>
				</div>
			</div>

			{#if isEditMode}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
					<div>
						<label
							for="edit-session-date"
							class="block text-xs sm:text-sm font-medium text-text-secondary mb-1"
						>
							Date
						</label>
						<input
							id="edit-session-date"
							type="date"
							bind:value={editingSessionDate}
							required
							class="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm text-text-primary min-h-[44px]"
						/>
					</div>
					<Textarea
						label="Session Notes"
						bind:value={editingSessionNotes}
						placeholder="Add notes about your session..."
						rows={2}
					/>
				</div>

				<div class="space-y-4">
					{#each editingExercises as exercise, exerciseIndex}
						<div class="border border-border rounded-lg overflow-hidden">
							<div class="bg-surface-elevated px-3 sm:px-4 py-2 sm:py-3 border-b border-border">
								<h4 class="font-semibold text-text-primary text-base sm:text-lg">
									{exercise.exerciseName}
								</h4>
								<p class="text-xs sm:text-sm text-text-secondary capitalize">
									{exercise.primaryMuscle}
								</p>
							</div>
							<div class="p-3 sm:p-4 space-y-3">
								{#each exercise.sets as set, setIndex}
									<div
										class="p-3 border border-border rounded-lg {set.completed
											? 'bg-success/5'
											: 'bg-surface-elevated'}"
									>
										<div class="flex items-center justify-between mb-3">
											<button
												type="button"
												onclick={() => toggleSetCompleted(exerciseIndex, setIndex)}
												class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors {set.completed
													? 'bg-success text-bg'
													: 'bg-surface text-text-muted border border-border'}"
											>
												{#if set.completed}
													<Check class="w-4 h-4" />
													<span>Set {setIndex + 1}</span>
												{:else}
													<span class="w-5 h-5 rounded-full border border-current"></span>
													<span>Set {setIndex + 1}</span>
												{/if}
											</button>
										</div>
										<div class="grid grid-cols-2 gap-3 mb-3">
											<NumberSpinner
												label="Reps"
												size="sm"
												value={set.reps}
												min={0}
												max={999}
												onchange={(v) => updateSetValue(exerciseIndex, setIndex, 'reps', v)}
											/>
											<NumberSpinner
												label="Weight ({preferencesStore.weightLabel})"
												size="sm"
												value={volumeWeight(set.weight)}
												min={0}
												max={9999}
												step={5}
												onchange={(v) => updateSetValue(exerciseIndex, setIndex, 'weight', v)}
											/>
										</div>
										<TextInput
											placeholder="Add note for this set..."
											value={set.notes || ''}
											onchange={(value) => updateSetNotes(exerciseIndex, setIndex, value)}
										/>
									</div>
								{/each}
								<div class="pt-2 border-t border-border">
									<TextInput
										label="Exercise Notes"
										placeholder="Add notes for this exercise..."
										value={exercise.notes || ''}
										onchange={(value) => updateExerciseNotes(exerciseIndex, value)}
									/>
								</div>
							</div>
						</div>
					{/each}
				</div>

				{#if saveError}
					<InfoBox type="error" class="mt-4">
						<p class="text-sm">{saveError}</p>
					</InfoBox>
				{/if}
			{:else}
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
								<h4 class="font-semibold text-text-primary text-base sm:text-lg">
									{exercise.exerciseName}
								</h4>
								<p class="text-xs sm:text-sm text-text-secondary capitalize">
									{exercise.primaryMuscle}
								</p>
							</div>
							<div class="p-3 sm:p-4">
								<div class="hidden sm:block">
									<table class="w-full">
										<thead>
											<tr class="border-b border-border">
												<th class="text-left py-2 text-sm font-medium text-text-secondary">Set</th>
												<th class="text-left py-2 text-sm font-medium text-text-secondary"
													>Reps</th
												>
												<th class="text-left py-2 text-sm font-medium text-text-secondary"
													>Weight</th
												>
												<th class="text-left py-2 text-sm font-medium text-text-secondary"
													>Status</th
												>
											</tr>
										</thead>
										<tbody>
											{#each exercise.sets as set, idx}
												<tr class={set.completed ? 'bg-success/5' : ''}>
													<td class="py-2 text-sm text-text-secondary">{idx + 1}</td>
													<td class="py-2 text-sm text-text-secondary">{set.reps}</td>
													<td class="py-2 text-sm text-text-secondary"
														>{formatSetWeight(set.weight)}</td
													>
													<td class="py-2 text-sm">
														<span
															class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium {set.completed
																? 'bg-success/20 text-success'
																: 'bg-surface-elevated text-text-muted'}"
														>
															{#if set.completed}
																<Check class="w-3 h-3" /> Completed
															{:else}
																— Skipped
															{/if}
														</span>
													</td>
												</tr>
												{#if set.notes}
													<tr>
														<td colspan="4" class="py-1 px-2 text-xs text-text-muted italic">
															{set.notes}
														</td>
													</tr>
												{/if}
											{/each}
										</tbody>
									</table>
								</div>

								<div class="sm:hidden space-y-2">
									{#each exercise.sets as set, idx}
										<div
											class="p-3 border border-border rounded-lg {set.completed
												? 'bg-success/10'
												: 'bg-surface-elevated'}"
										>
											<div class="flex items-center justify-between">
												<div class="flex items-center gap-3">
													<span
														class="w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium {set.completed
															? 'bg-success text-bg'
															: 'bg-surface text-text-muted'}"
													>
														{idx + 1}
													</span>
													<div>
														<p class="text-sm font-medium text-text-primary">
															{set.reps} reps × {formatSetWeight(set.weight)}
														</p>
													</div>
												</div>
												<span
													class="text-xs font-medium px-2 py-1 rounded-full {set.completed
														? 'bg-success/20 text-success'
														: 'bg-surface text-text-muted'}"
												>
													{set.completed ? 'Done' : 'Skip'}
												</span>
											</div>
											{#if set.notes}
												<p class="mt-2 text-xs text-text-muted italic pl-11">{set.notes}</p>
											{/if}
										</div>
									{/each}
								</div>

								{#if exercise.notes}
									<div class="mt-3 pt-3 border-t border-border">
										<p class="text-sm text-text-secondary">
											<span class="font-medium">Notes:</span>
											{exercise.notes}
										</p>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	{/snippet}
	{#snippet footer()}
		{#if isEditMode}
			<Button variant="ghost" onclick={cancelEditMode}>Cancel</Button>
			<Button variant="primary" onclick={saveSessionEdits}>Save Changes</Button>
		{:else}
			<Button
				variant="secondary"
				onclick={() => {
					showSessionDetail = null;
				}}
			>
				Close
			</Button>
			<Button variant="primary" onclick={enterEditMode}>Edit Session</Button>
		{/if}
	{/snippet}
</Modal>

<!-- Delete Confirmation -->
<ConfirmDialog
	open={showDeleteConfirm}
	title="Delete Session"
	message={'This will permanently delete the session from ' +
		formatDate(showSessionDetail?.date || '') +
		'. This action cannot be undone.'}
	confirmText="Delete Session"
	confirmVariant="danger"
	onconfirm={confirmDelete}
	oncancel={closeDeleteConfirm}
/>

<!-- Undo Toast -->
{#if showUndoToast}
	<div
		class="fixed bottom-20 md:bottom-4 right-4 bg-surface border border-warning/30 rounded-lg shadow-xl p-4 max-w-md z-[70] flex items-start gap-3"
		transition:fly={{ x: 100, duration: 200 }}
	>
		<div class="flex-1">
			<p class="font-medium text-text-primary mb-1">Session deleted</p>
			<p class="text-sm text-text-secondary mb-2">
				The session has been removed from your history.
			</p>
			<Button variant="primary" size="sm" onclick={undoDelete}>Undo</Button>
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
			<X class="w-5 h-5" />
		</button>
	</div>
{/if}
