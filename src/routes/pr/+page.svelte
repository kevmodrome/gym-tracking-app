<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import { getAllPersonalRecords, getPRHistoryForExercise, getRepRangeLabel } from '$lib/prUtils';
	import type { PersonalRecord, Exercise } from '$lib/types';

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
				<a
					href="/"
					class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
				>
					← Back
				</a>
				<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Personal Records</h1>
			</div>
			<button
				onclick={() => window.location.reload()}
				class="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base min-h-[44px]"
				type="button"
			>
				Refresh
			</button>
		</div>

		{#if allPRs.length === 0}
			<div class="bg-white rounded-lg shadow-md p-8 sm:p-12 text-center">
				<div class="text-4xl sm:text-6xl mb-3 sm:mb-4">🏆</div>
				<h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Personal Records Yet</h2>
				<p class="text-sm sm:text-base text-gray-600">
					Start logging your workouts to track your personal records!
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
				{#each groupedPRs as group}
					<div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
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
									<button
										onclick={() => showHistory(pr)}
										class="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors text-xs sm:text-sm min-h-[44px] sm:min-h-0 self-start sm:self-auto"
										type="button"
									>
										View History
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if selectedExerciseId && prHistory.length > 0}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
		<div class="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] sm:max-h-[95vh] overflow-y-auto my-4 sm:my-0">
			<div class="p-4 sm:p-6">
				<div class="flex items-center justify-between mb-3 sm:mb-4">
					<h3 class="text-base sm:text-xl font-bold text-gray-900">
						PR History - {getExerciseName(selectedExerciseId)}
					</h3>
					<button
						onclick={closeHistory}
						class="text-gray-400 hover:text-gray-600 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
						type="button"
					>
						✕
					</button>
				</div>

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

				<div class="mt-4 sm:mt-6">
					<button
						onclick={closeHistory}
						class="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors min-h-[44px]"
						type="button"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
