<script lang="ts">
	import { onMount } from 'svelte';
	import { db, liveQuery } from '$lib/db';
	import type { Exercise } from '$lib/types';
	import { getPRHistoryForExercise, getRepRangeLabel } from '$lib/prUtils';
	import type { PersonalRecord } from '$lib/types';
	import { Card, Modal, Button } from '$lib/ui';

	let exercises = $state<Exercise[]>([]);
	let allPRs = $state<PersonalRecord[]>([]);
	let selectedExerciseId = $state<string | null>(null);
	let prHistory = $state<any[]>([]);

	onMount(() => {
		liveQuery(() => db.exercises.toArray()).subscribe((data) => {
			exercises = data;
		});
		liveQuery(() => db.personalRecords.toArray()).subscribe((data) => {
			allPRs = data;
		});
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
