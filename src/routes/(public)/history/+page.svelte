<script lang="ts">
	import { onMount } from 'svelte';
	import { db, liveQuery } from '$lib/db';
	import type { Session, Exercise } from '$lib/types';
	import { calculatePersonalRecords } from '$lib/prUtils';
	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import XIcon from '$lib/components/XIcon.svelte';
	import ChevronUpIcon from '$lib/components/ChevronUpIcon.svelte';
	import ChevronDownIcon from '$lib/components/ChevronDownIcon.svelte';
	import { Button, Card, Modal, ConfirmDialog, Select, TextInput, Textarea, InfoBox } from '$lib/ui';

	let sessions = $state<Session[]>([]);
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
		allWorkouts = (await db.workouts.toArray()).map((w) => ({ id: w.id, name: w.name }));

		liveQuery(() => db.sessions.orderBy('date').reverse().toArray()).subscribe((data) => {
			sessions = data;
		});
	});

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

	const totalPages = $derived(Math.ceil(filteredSessions.length / itemsPerPage));

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
</script>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-7xl mx-auto w-full">
		<div class="flex items-center gap-4 mb-6">
			<Button variant="ghost" href="/">
				← Back
			</Button>
			<h1 class="text-2xl sm:text-3xl font-display font-bold text-text-primary">Workout History</h1>
		</div>

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
						<TextInput
							label="Start Date"
							type="date"
							bind:value={customStartDate}
						/>
						<TextInput
							label="End Date"
							type="date"
							bind:value={customEndDate}
						/>
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
				{#each paginatedSessions as session, index}
					<Card hover>
						{#snippet children()}
							<button
								class="w-full text-left"
								onclick={() => (showSessionDetail = session)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										showSessionDetail = session;
									}
								}}
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
	</div>
</div>

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
				<InfoBox variant="info" class="mb-4">
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

<ConfirmDialog
	open={showDeleteConfirm}
	title="Delete Workout"
	message={'This will permanently delete "' + (showSessionDetail?.workoutName || '') + '" from ' + formatDate(showSessionDetail?.date || '') + '. This action cannot be undone.'}
	confirmText="Delete Workout"
	confirmVariant="danger"
	onconfirm={confirmDelete}
	oncancel={closeDeleteConfirm}
/>

<Modal
	open={showEditModal}
	title="Edit Workout"
	size="sm"
	onclose={closeEditModal}
>
	{#snippet children()}
		<div class="space-y-4">
			<TextInput
				label="Date"
				type="date"
				bind:value={editForm.date}
				required
			/>

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
				<InfoBox variant="error">
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

