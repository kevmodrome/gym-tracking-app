<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import { getAllPersonalRecords, getPRHistoryForExercise, getRepRangeLabel } from '$lib/prUtils';
	import type { PersonalRecord, Exercise } from '$lib/types';
	import { Button, Card, Modal } from '$lib/ui';

	let allPRs = $state<PersonalRecord[]>([]);
	let exercises = $state<Exercise[]>([]);
	let selectedExerciseId = $state<string | null>(null);
	let prHistory = $state<any[]>([]);

	onMount(async () => {
		exercises = await db.exercises.toArray();
		allPRs = await getAllPersonalRecords();
	});

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
</script>

<div class="min-h-screen bg-gray-100 p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-7xl mx-auto w-full">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
			<div class="flex items-center gap-4">
				<Button variant="ghost" href="/">
					← Back
				</Button>
				<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Personal Records</h1>
			</div>
			<Button onclick={() => window.location.reload()}>
				Refresh
			</Button>
		</div>

		{#if allPRs.length === 0}
			<Card class="text-center" padding="lg">
				{#snippet children()}
					<div class="text-4xl sm:text-6xl mb-3 sm:mb-4">🏆</div>
					<h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Personal Records Yet</h2>
					<p class="text-sm sm:text-base text-gray-600">
						Start logging your workouts to track your personal records!
					</p>
				{/snippet}
			</Card>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
				{#each groupedPRs as group}
					<Card>
						{#snippet children()}
							<h2 class="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">{group.exerciseName}</h2>
							<div class="space-y-2 sm:space-y-3">
								{#each group.prs as pr}
									<div
										class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200"
									>
										<div class="flex items-center gap-2 sm:gap-3">
											<div class="w-9 h-9 sm:w-10 sm:h-10 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
												🏆
											</div>
											<div>
												<p class="font-semibold text-gray-900 text-sm sm:text-base">
													{getRepRangeLabel(pr.reps)}: {pr.weight} lbs
												</p>
												<p class="text-xs sm:text-sm text-gray-500">
													{new Date(pr.achievedDate).toLocaleDateString()}
												</p>
											</div>
										</div>
										<Button
											variant="ghost"
											size="sm"
											onclick={() => showHistory(pr)}
											class="self-start sm:self-auto bg-blue-100 text-blue-800 hover:bg-blue-200"
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
	</div>
</div>

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
							? 'bg-yellow-50 border-2 border-yellow-400'
							: 'bg-gray-50'} rounded-lg"
					>
						<div>
							<p class="font-semibold text-gray-900 text-sm sm:text-base">
								{entry.weight} lbs @ {entry.reps} reps
							</p>
							<p class="text-xs sm:text-sm text-gray-500">
								{new Date(entry.achievedDate).toLocaleDateString()}
							</p>
						</div>
						{#if i === 0}
							<span class="text-xl sm:text-2xl">🏆</span>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-gray-500 text-center py-8 text-sm sm:text-base">No history available for this rep range</p>
		{/if}
	{/snippet}
	{#snippet footer()}
		<Button variant="ghost" fullWidth onclick={closeHistory}>
			Close
		</Button>
	{/snippet}
</Modal>
