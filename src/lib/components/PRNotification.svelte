<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import type { PersonalRecord } from '$lib/types';
	import { getRepRangeLabel } from '$lib/prUtils';

	interface Props {
		newPRs: PersonalRecord[];
		onClose: () => void;
	}

	let { newPRs, onClose }: Props = $props();
</script>

<div class="fixed top-4 right-4 z-50">
	<div class="space-y-2">
		{#each newPRs as pr, i (pr.id)}
			<div
				transition:fly={{ y: -20, duration: 300 }}
				class="bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-400 rounded-lg shadow-lg p-4 min-w-[300px]"
			>
				<div class="flex items-start gap-3">
					<div class="w-12 h-12 bg-yellow-500 text-white rounded-full flex items-center justify-center text-2xl shrink-0">
						🏆
					</div>
					<div class="flex-1">
						<h3 class="font-bold text-gray-900 mb-1">New Personal Record!</h3>
						<p class="text-sm text-gray-700 font-semibold">{pr.exerciseName}</p>
						<p class="text-lg font-bold text-yellow-800">
							{getRepRangeLabel(pr.reps)}: {pr.weight} lbs
						</p>
						<p class="text-xs text-gray-500 mt-1">
							{new Date(pr.achievedDate).toLocaleDateString()}
						</p>
					</div>
					<button
						onclick={onClose}
						class="text-gray-400 hover:text-gray-600"
						type="button"
					>
						✕
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>
