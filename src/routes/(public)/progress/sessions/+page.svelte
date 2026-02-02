<script lang="ts">
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import type { Session } from '$lib/types';
	import { calculatePersonalRecords } from '$lib/prUtils';
	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import XIcon from '$lib/components/XIcon.svelte';
	import ChevronDownIcon from '$lib/components/ChevronDownIcon.svelte';
	import { Button, Card, Modal, ConfirmDialog, Select, TextInput, Textarea, InfoBox, SearchInput, NumberSpinner } from '$lib/ui';
	import type { SessionExercise, ExerciseSet } from '$lib/types';
	import { invalidateSessions, invalidatePersonalRecords } from '$lib/invalidation';

	let { data } = $props();

	// Data from load function
	const sessions = $derived(data.sessions);

	// Helper to get muscle groups from a session
	function getSessionMuscleGroups(session: Session): string[] {
		const muscles = new Set<string>();
		for (const exercise of session.exercises) {
			if (exercise.primaryMuscle) {
				muscles.add(exercise.primaryMuscle);
			}
		}
		return Array.from(muscles);
	}

	// Helper to get a session title from muscle groups
	function getSessionTitle(session: Session): string {
		const muscles = getSessionMuscleGroups(session);
		if (muscles.length === 0) return 'Session';
		return muscles.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
	}

	// UI state
	let searchQuery = $state('');
	let dateFilter = $state<'all' | 'week' | 'month' | 'year' | 'custom'>('all');
	let customStartDate = $state('');
	let customEndDate = $state('');
	let currentPage = $state(1);
	let itemsPerPage = $state(10);
	let showSessionDetail = $state<Session | null>(null);
	let showDeleteConfirm = $state(false);
	let showUndoToast = $state(false);
	let deletedSession = $state<Session | null>(null);
	let undoTimeout: number | null = null;
	let deleteError = $state<string | null>(null);
	let saveError = $state<string | null>(null);

	// Edit mode state for the detail modal
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

		// Filter by search query (exercise names or muscle groups)
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			filtered = filtered.filter((session) => {
				// Search in exercise names
				const matchesExercise = session.exercises.some(e =>
					e.exerciseName.toLowerCase().includes(query)
				);
				// Search in muscle groups
				const matchesMuscle = getSessionMuscleGroups(session).some(m =>
					m.toLowerCase().includes(query)
				);
				return matchesExercise || matchesMuscle;
			});
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
		const mins = Math.round(minutes % 60);
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
			await invalidateSessions();
			await invalidatePersonalRecords();

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
			await invalidateSessions();
			await invalidatePersonalRecords();

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
		// Deep clone the exercises for editing
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

			await db.sessions.update(showSessionDetail.id, {
				exercises: updatedSession.exercises,
				notes: updatedSession.notes,
				date: updatedSession.date
			});

			await calculatePersonalRecords();
			await invalidateSessions();
			await invalidatePersonalRecords();

			showSessionDetail = updatedSession;
			isEditMode = false;
			editingExercises = [];
			editingSessionNotes = '';
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Failed to save changes';
		}
	}

	function updateSetValue(exerciseIndex: number, setIndex: number, field: 'reps' | 'weight', value: number) {
		editingExercises[exerciseIndex].sets[setIndex][field] = value;
	}

	function updateSetNotes(exerciseIndex: number, setIndex: number, notes: string) {
		editingExercises[exerciseIndex].sets[setIndex].notes = notes || undefined;
	}

	function toggleSetCompleted(exerciseIndex: number, setIndex: number) {
		editingExercises[exerciseIndex].sets[setIndex].completed = !editingExercises[exerciseIndex].sets[setIndex].completed;
	}

	function updateExerciseNotes(exerciseIndex: number, notes: string) {
		editingExercises[exerciseIndex].notes = notes || undefined;
	}
</script>

<Card class="mb-6">
	{#snippet children()}
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
			<SearchInput
				label="Search"
				bind:value={searchQuery}
				placeholder="Search exercises or muscle groups..."
			/>

			<Select
				label="Date Range"
				bind:value={dateFilter}
				options={dateOptions}
			/>

			<div>
				<span class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
					Showing: {filteredSessions.length} sessions
				</span>
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
								<h3 class="text-xl font-semibold text-text-primary mb-2">{getSessionTitle(session)}</h3>
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
					<div class="flex items-center gap-2 mt-4 pt-4 border-t border-border">
						<Button variant="success" size="sm" onclick={() => rerunSession(session)}>
							Re-run
						</Button>
						<Button variant="danger" size="sm" onclick={() => openDeleteConfirmForSession(session)}>
							Delete
						</Button>
					</div>
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

<!-- Session Detail Modal -->
<Modal
	open={showSessionDetail !== null}
	title={showSessionDetail ? getSessionTitle(showSessionDetail) : ''}
	size="xl"
	onclose={() => { showSessionDetail = null; cancelEditMode(); }}
>
	{#snippet children()}
		{#if showSessionDetail}
			<div class="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-4">
				<p class="text-sm text-text-secondary">{formatDate(showSessionDetail.date)}</p>
				<div class="text-right">
					<p class="text-xs sm:text-sm text-text-muted">Duration</p>
					<p class="text-base sm:text-lg font-semibold text-text-primary">{formatDuration(showSessionDetail.duration)}</p>
				</div>
			</div>

			{#if isEditMode}
				<!-- Edit Mode: Date and Session Notes -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
					<div>
						<label for="edit-session-date" class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">Date</label>
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

				<!-- Edit Mode: Exercises -->
				<div class="space-y-4">
					{#each editingExercises as exercise, exerciseIndex}
						<div class="border border-border rounded-lg overflow-hidden">
							<div class="bg-surface-elevated px-3 sm:px-4 py-2 sm:py-3 border-b border-border">
								<h4 class="font-semibold text-text-primary text-base sm:text-lg">{exercise.exerciseName}</h4>
								<p class="text-xs sm:text-sm text-text-secondary capitalize">{exercise.primaryMuscle}</p>
							</div>

							<div class="p-3 sm:p-4 space-y-3">
								{#each exercise.sets as set, setIndex}
									<div class="p-3 border border-border rounded-lg {set.completed ? 'bg-success/5' : 'bg-surface-elevated'}">
										<div class="flex items-center gap-3 mb-2">
											<button
												type="button"
												onclick={() => toggleSetCompleted(exerciseIndex, setIndex)}
												class="w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors {set.completed ? 'bg-success text-bg' : 'bg-surface text-text-muted border border-border'}"
											>
												{set.completed ? '✓' : setIndex + 1}
											</button>
											<div class="flex items-center gap-4 flex-1">
												<div class="flex items-center gap-2">
													<span class="text-xs text-text-muted">Reps</span>
													<NumberSpinner
														value={set.reps}
														min={0}
														max={999}
														onchange={(v) => updateSetValue(exerciseIndex, setIndex, 'reps', v)}
													/>
												</div>
												<div class="flex items-center gap-2">
													<span class="text-xs text-text-muted">Weight</span>
													<NumberSpinner
														value={set.weight}
														min={0}
														max={9999}
														step={5}
														onchange={(v) => updateSetValue(exerciseIndex, setIndex, 'weight', v)}
													/>
												</div>
											</div>
										</div>
										<TextInput
											placeholder="Add note for this set..."
											value={set.notes || ''}
											onchange={(value) => updateSetNotes(exerciseIndex, setIndex, value)}
										/>
									</div>
								{/each}

								<!-- Exercise-level notes -->
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
				<!-- View Mode -->
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
										<div class="p-3 border border-border rounded-lg {set.completed ? 'bg-success/10' : 'bg-surface-elevated'}">
											<div class="flex items-center justify-between">
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
											{#if set.notes}
												<p class="mt-2 text-xs text-text-muted italic pl-11">{set.notes}</p>
											{/if}
										</div>
									{/each}
								</div>

								{#if exercise.notes}
									<div class="mt-3 pt-3 border-t border-border">
										<p class="text-sm text-text-secondary"><span class="font-medium">Notes:</span> {exercise.notes}</p>
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
			<Button variant="ghost" onclick={cancelEditMode}>
				Cancel
			</Button>
			<Button variant="primary" onclick={saveSessionEdits}>
				Save Changes
			</Button>
		{:else}
			<Button variant="primary" onclick={enterEditMode}>
				Edit Session
			</Button>
			<Button variant="secondary" onclick={() => { showSessionDetail = null; }}>
				Close
			</Button>
		{/if}
	{/snippet}
</Modal>

<!-- Delete Confirmation -->
<ConfirmDialog
	open={showDeleteConfirm}
	title="Delete Session"
	message={'This will permanently delete the session from ' + formatDate(showSessionDetail?.date || '') + '. This action cannot be undone.'}
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
