<script lang="ts">
	import type { Exercise } from '$lib/types';
	import { Button, SearchInput } from '$lib/ui';
	import { Plus, Star } from 'lucide-svelte';

	interface ExercisePickerProps {
		exercises: Exercise[];
		/** Called when the user picks an exercise. */
		onSelect: (exercise: Exercise) => void;
		/** Optional: toggle favorite state. */
		onToggleFavorite?: (exercise: Exercise) => void;
		/** Optional placeholder for the search input. */
		placeholder?: string;
		/** Class for the scrollable list wrapper. */
		listClass?: string;
	}

	let {
		exercises,
		onSelect,
		onToggleFavorite,
		placeholder = 'Search exercises...',
		listClass = 'max-h-[60vh]'
	}: ExercisePickerProps = $props();

	let query = $state('');
	let muscleFilter = $state<string>('all');

	const muscleGroups = $derived.by(() => {
		const groups = new Set<string>();
		for (const ex of exercises) groups.add(ex.primary_muscle);
		return Array.from(groups).sort();
	});

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		let list = exercises;
		if (q) {
			list = list.filter(
				(ex) =>
					ex.name.toLowerCase().includes(q) ||
					ex.primary_muscle.toLowerCase().includes(q)
			);
		}
		if (muscleFilter !== 'all') {
			list = list.filter((ex) => ex.primary_muscle === muscleFilter);
		}
		return [...list].sort((a, b) => {
			if (a.favorited && !b.favorited) return -1;
			if (!a.favorited && b.favorited) return 1;
			return a.name.localeCompare(b.name);
		});
	});
</script>

<div class="space-y-3">
	<SearchInput bind:value={query} {placeholder} />

	{#if muscleGroups.length > 1}
		<div class="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
			<button
				type="button"
				onclick={() => (muscleFilter = 'all')}
				class="shrink-0 px-3 h-8 rounded-full text-xs font-medium transition-colors
					{muscleFilter === 'all'
						? 'bg-text-primary text-bg'
						: 'bg-surface-elevated text-text-secondary border border-border hover:text-text-primary'}"
			>
				All
			</button>
			{#each muscleGroups as muscle (muscle)}
				<button
					type="button"
					onclick={() => (muscleFilter = muscle)}
					class="shrink-0 px-3 h-8 rounded-full text-xs font-medium capitalize transition-colors
						{muscleFilter === muscle
							? 'bg-text-primary text-bg'
							: 'bg-surface-elevated text-text-secondary border border-border hover:text-text-primary'}"
				>
					{muscle}
				</button>
			{/each}
		</div>
	{/if}

	<div
		class="overflow-y-auto rounded-lg border border-border divide-y divide-border {listClass}"
	>
		{#each filtered as ex (ex.id)}
			<div class="flex items-center gap-2 p-3 hover:bg-surface-elevated transition-colors">
				{#if onToggleFavorite}
					<button
						class="p-1 text-text-muted hover:text-warning transition-colors"
						onclick={() => onToggleFavorite?.(ex)}
						aria-label={ex.favorited ? 'Unfavorite' : 'Favorite'}
						type="button"
					>
						<Star class="w-4 h-4 {ex.favorited ? 'fill-warning text-warning' : ''}" />
					</button>
				{/if}
				<button
					class="flex-1 text-left min-w-0"
					onclick={() => onSelect(ex)}
					type="button"
				>
					<p class="font-medium text-sm text-text-primary truncate">{ex.name}</p>
					<p class="text-xs text-text-muted truncate capitalize">
						{ex.primary_muscle} · {ex.category}
					</p>
				</button>
				<Button variant="ghost" size="sm" onclick={() => onSelect(ex)}>
					<Plus class="w-4 h-4" />
					Add
				</Button>
			</div>
		{:else}
			<div class="p-6 text-center text-sm text-text-muted">No exercises match.</div>
		{/each}
	</div>
</div>