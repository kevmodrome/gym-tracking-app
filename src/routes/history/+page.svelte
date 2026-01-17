<script lang="ts">
	import { onMount } from 'svelte';
	import { db, liveQuery } from '$lib/db';
	import type { Session, Exercise } from '$lib/types';
	import { calculatePersonalRecords } from '$lib/prUtils';
	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import XIcon from '$lib/components/XIcon.svelte';
	import ChevronUpIcon from '$lib/components/ChevronUpIcon.svelte';
	import ChevronDownIcon from '$lib/components/ChevronDownIcon.svelte';

	let sessions = $state<Session[]>([]);
	let allWorkouts = $state<{ id: string; name: string }[]>([]);
	let searchQuery = $state('');
	let selectedWorkout = $state<string | undefined>(undefined);
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
		selectedWorkout = undefined;
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
				<h1 class="text-3xl font-bold text-gray-900">Workout History</h1>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div class="relative">
					<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search workouts..."
						class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>

				<div>
					<label for="workout-filter" class="block text-sm font-medium text-gray-700 mb-1">
						Workout Type
					</label>
					<select
						id="workout-filter"
						bind:value={selectedWorkout}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						<option value="">All Workouts</option>
						{#each allWorkouts as workout}
							<option value={workout.id}>{workout.name}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="date-filter" class="block text-sm font-medium text-gray-700 mb-1">
						Date Range
					</label>
					<select
						id="date-filter"
						bind:value={dateFilter}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						<option value="all">All Time</option>
						<option value="week">Last 7 Days</option>
						<option value="month">Last 30 Days</option>
						<option value="year">Last Year</option>
						<option value="custom">Custom Range</option>
					</select>
				</div>

				<div>
					<label for="results-count" class="block text-sm font-medium text-gray-700 mb-1">
						Showing: {filteredSessions.length} sessions
					</label>
					<div class="flex items-center gap-2">
						<button
							onclick={clearFilters}
							class="flex-1 flex items-center justify-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
							type="button"
						>
							<XIcon class="w-4 h-4" />
							Clear
						</button>
					</div>
				</div>
			</div>

			{#if dateFilter === 'custom'}
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
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
			{/if}
		</div>

		{#if filteredSessions.length === 0}
			<div class="bg-white rounded-lg shadow-md p-12 text-center">
				<div class="text-gray-400 mb-4">
					<SearchIcon class="w-16 h-16 mx-auto" />
				</div>
				<h2 class="text-xl font-semibold text-gray-900 mb-2">No workout sessions found</h2>
				<p class="text-gray-600">
					{#if sessions.length === 0}
						Start working out to see your history here
					{:else}
						Try adjusting your search or filters
					{/if}
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4">
				{#each paginatedSessions as session, index}
					<button
						class="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow cursor-pointer w-full text-left"
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
								<h3 class="text-xl font-semibold text-gray-900 mb-2">{session.workoutName}</h3>
								<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
									<div class="flex items-center gap-2">
										<span class="text-gray-500">📅</span>
										<span class="text-sm text-gray-700">{formatDate(session.date)}</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="text-gray-500">⏱️</span>
										<span class="text-sm text-gray-700">{formatDuration(session.duration)}</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="text-gray-500">💪</span>
										<span class="text-sm text-gray-700">{getSessionSummary(session)}</span>
									</div>
								</div>
								{#if session.notes}
									<p class="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
										{session.notes}
									</p>
								{/if}
							</div>
							<div class="flex items-center gap-2 ml-4">
								<ChevronDownIcon class="w-5 h-5 text-gray-400" />
							</div>
						</div>
					</button>
				{/each}
			</div>

			{#if hasMore}
				<div class="mt-6 text-center">
					<button
						onclick={loadMore}
						class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
						type="button"
					>
						Load More Sessions
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

{#if showSessionDetail}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
		<div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
			<div class="sticky top-0 bg-white border-b border-gray-200 p-6">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-2xl font-bold text-gray-900">{showSessionDetail.workoutName}</h2>
						<p class="text-sm text-gray-600">{formatDate(showSessionDetail.date)}</p>
					</div>
					<div class="flex items-center gap-4">
						<div class="text-right">
							<p class="text-sm text-gray-500">Duration</p>
							<p class="text-lg font-semibold">{formatDuration(showSessionDetail.duration)}</p>
						</div>
						<button
							onclick={openEditModal}
							class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
							type="button"
						>
							Edit
						</button>
						<button
							onclick={() => (showDeleteConfirm = true)}
							class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
							type="button"
						>
							Delete
						</button>
						<button
							onclick={() => (showSessionDetail = null)}
							class="p-2 hover:bg-gray-100 rounded-full transition-colors"
							type="button"
						>
							<XIcon class="w-6 h-6 text-gray-500" />
						</button>
					</div>
				</div>
			</div>

			<div class="p-6 space-y-6">
				{#if showSessionDetail.notes}
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
						<h3 class="font-semibold text-blue-900 mb-2">Notes</h3>
						<p class="text-blue-800">{showSessionDetail.notes}</p>
					</div>
				{/if}

				<div class="space-y-4">
					{#each showSessionDetail.exercises as exercise}
						<div class="border border-gray-200 rounded-lg overflow-hidden">
							<div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
								<h4 class="font-semibold text-gray-900">{exercise.exerciseName}</h4>
								<p class="text-sm text-gray-600 capitalize">{exercise.primaryMuscle}</p>
							</div>
							<div class="p-4">
								<table class="w-full">
									<thead>
										<tr class="border-b border-gray-200">
											<th class="text-left py-2 text-sm font-medium text-gray-700">Set</th>
											<th class="text-left py-2 text-sm font-medium text-gray-700">Reps</th>
											<th class="text-left py-2 text-sm font-medium text-gray-700">Weight</th>
											<th class="text-left py-2 text-sm font-medium text-gray-700">Status</th>
										</tr>
									</thead>
									<tbody>
										{#each exercise.sets as set, idx}
											<tr class:completed={set.completed}>
												<td class="py-2 text-sm text-gray-700">{idx + 1}</td>
												<td class="py-2 text-sm text-gray-700">{set.reps}</td>
												<td class="py-2 text-sm text-gray-700">{set.weight} lbs</td>
												<td class="py-2 text-sm">
													<span
														class="px-2 py-1 rounded-full text-xs font-medium {set.completed
															? 'bg-green-100 text-green-800'
															: 'bg-gray-100 text-gray-600'}"
													>
														{set.completed ? '✓ Completed' : '— Skipped'}
													</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end">
				<button
					onclick={() => (showSessionDetail = null)}
					class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
					type="button"
				>
					Close
				</button>
			</div>
		</div>
	</div>

	{#if showDeleteConfirm}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
			<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-bold text-gray-900">Delete Workout</h2>
					<button
						onclick={closeDeleteConfirm}
						type="button"
					>
						<XIcon class="w-6 h-6 text-gray-500" />
					</button>
				</div>

				<div class="space-y-4">
					<div class="bg-red-50 border border-red-200 rounded-lg p-4">
						<p class="text-red-900 font-medium mb-2">Are you sure?</p>
						<p class="text-sm text-red-800">
							This will permanently delete "{showSessionDetail?.workoutName}" from
							{formatDate(showSessionDetail?.date || '')}. This action cannot be undone.
						</p>
					</div>

					{#if deleteError}
						<div class="bg-red-100 border border-red-300 rounded-lg p-3">
							<p class="text-sm text-red-800">{deleteError}</p>
						</div>
					{/if}

					<div class="flex gap-3">
						<button
							onclick={closeDeleteConfirm}
							class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
							type="button"
						>
							Cancel
						</button>
						<button
							onclick={confirmDelete}
							class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
							type="button"
						>
							Delete Workout
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if showEditModal}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
			<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-bold text-gray-900">Edit Workout</h2>
					<button
						onclick={closeEditModal}
						type="button"
					>
						<XIcon class="w-6 h-6 text-gray-500" />
					</button>
				</div>

				<div class="space-y-4 mb-6">
					<div>
						<label for="edit-date" class="block text-sm font-medium text-gray-700 mb-1">
							Date <span class="text-red-500">*</span>
						</label>
						<input
							id="edit-date"
							type="date"
							bind:value={editForm.date}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>

					<div>
						<label for="edit-name" class="block text-sm font-medium text-gray-700 mb-1">
							Workout Name
						</label>
						<input
							id="edit-name"
							type="text"
							bind:value={editForm.name}
							placeholder="Workout name"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>

					<div>
						<label for="edit-notes" class="block text-sm font-medium text-gray-700 mb-1">
							Notes
						</label>
						<textarea
							id="edit-notes"
							bind:value={editForm.notes}
							placeholder="Add notes about your workout..."
							rows="3"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
						></textarea>
					</div>

					{#if saveError}
						<div class="bg-red-100 border border-red-300 rounded-lg p-3">
							<p class="text-sm text-red-800">{saveError}</p>
						</div>
					{/if}
				</div>

				<div class="flex gap-3">
					<button
						onclick={closeEditModal}
						class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
						type="button"
					>
						Cancel
					</button>
					<button
						onclick={saveSessionChanges}
						class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
						type="button"
					>
						Save Changes
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}

{#if showUndoToast}
	<div class="fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-xl p-4 max-w-md z-[70] flex items-start gap-3">
		<div class="flex-1">
			<p class="font-medium mb-1">Workout deleted</p>
			<p class="text-sm text-gray-300 mb-2">
				"{deletedSession?.workoutName}" has been removed from your history.
			</p>
			<button
				onclick={undoDelete}
				class="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors"
				type="button"
			>
				Undo
			</button>
		</div>
		<button
			onclick={() => {
				showUndoToast = false;
				if (undoTimeout) clearTimeout(undoTimeout);
				undoTimeout = null;
				deletedSession = null;
			}}
			class="text-gray-400 hover:text-white"
			type="button"
		>
			<XIcon class="w-5 h-5" />
		</button>
	</div>
{/if}

<style>
	tr.completed:nth-child(even) {
		background-color: #f0fdf4;
	}
	tr.completed:nth-child(odd) {
		background-color: #dcfce7;
	}
</style>
