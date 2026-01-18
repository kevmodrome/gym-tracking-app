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
				class="bg-gradient-to-r from-warning/20 to-warning/10 border-2 border-warning rounded-xl shadow-[0_0_30px_rgba(255,149,0,0.3)] p-4 min-w-[300px]"
			>
				<div class="flex items-start gap-3">
					<div class="w-12 h-12 bg-warning text-bg rounded-full flex items-center justify-center text-2xl shrink-0 shadow-[0_0_20px_rgba(255,149,0,0.5)]">
						🏆
					</div>
					<div class="flex-1">
						<h3 class="font-display font-bold text-text-primary mb-1">New Personal Record!</h3>
						<p class="text-sm text-text-secondary font-semibold">{pr.exerciseName}</p>
						<p class="text-lg font-display font-bold text-warning">
							{getRepRangeLabel(pr.reps)}: {pr.weight} lbs
						</p>
						<p class="text-xs text-text-muted mt-1">
							{new Date(pr.achievedDate).toLocaleDateString()}
						</p>
					</div>
					<button
						onclick={onClose}
						class="text-text-muted hover:text-text-primary transition-colors"
						type="button"
					>
						✕
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>
