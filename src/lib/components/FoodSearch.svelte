<script lang="ts">
	import { onMount } from 'svelte';
	import { SearchInput } from '$lib/ui';
	import { searchSavedFoods } from '$lib/nutrition/db';
	import { loadLivs, searchLivs, type LivsFood } from '$lib/nutrition/livs';
	import type { Food } from '$lib/types';
	import type { PickedFood } from '$lib/nutrition/picked';

	interface Props {
		onPick: (food: PickedFood) => void;
	}

	const { onPick }: Props = $props();

	let query = $state('');
	let saved = $state<Food[]>([]);
	let livs = $state<LivsFood[]>([]);

	onMount(async () => {
		await loadLivs();
	});

	$effect(() => {
		const q = query;
		(async () => {
			saved = await searchSavedFoods(q, 8);
			livs = q.trim() ? searchLivs(q, 12) : [];
		})();
	});

	function pickSaved(f: Food) {
		onPick({ source: 'saved', name: f.name, per100g: f.per100g, savedFoodId: f.id });
	}

	function pickLivsFood(f: LivsFood) {
		onPick({ source: 'livs', name: f.name, per100g: f.per100g, livsId: f.id });
	}
</script>

<div class="space-y-3">
	<SearchInput bind:value={query} placeholder="Search foods…" />

	{#if saved.length > 0}
		<div>
			<div class="text-xs uppercase tracking-wide text-text-secondary mb-1">Saved</div>
			<ul class="divide-y divide-border rounded-lg bg-surface">
				{#each saved as f (f.id)}
					<li>
						<button type="button" class="w-full text-left p-3 hover:bg-surface-hover" onclick={() => pickSaved(f)}>
							<div class="font-medium">{f.name}{#if f.brand} <span class="text-text-secondary text-xs">({f.brand})</span>{/if}</div>
							<div class="text-xs text-text-secondary">{f.per100g.kcal}kcal · {f.per100g.protein}g P /100g</div>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if livs.length > 0}
		<div>
			<div class="flex items-baseline justify-between mb-1">
				<div class="text-xs uppercase tracking-wide text-text-secondary">Livsmedelsverket</div>
				<a
					href="https://creativecommons.org/licenses/by/4.0/"
					target="_blank"
					rel="noreferrer"
					class="text-[10px] text-text-muted hover:text-text-secondary"
				>CC BY 4.0</a>
			</div>
			<ul class="divide-y divide-border rounded-lg bg-surface">
				{#each livs as f (f.id)}
					<li>
						<button type="button" class="w-full text-left p-3 hover:bg-surface-hover" onclick={() => pickLivsFood(f)}>
							<div class="font-medium">{f.name}</div>
							<div class="text-xs text-text-secondary">{f.per100g.kcal}kcal · {f.per100g.protein}g P /100g</div>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if query.trim() && saved.length === 0 && livs.length === 0}
		<p class="text-sm text-text-secondary text-center py-3">No matches.</p>
	{/if}
</div>
