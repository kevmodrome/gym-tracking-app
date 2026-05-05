<script lang="ts">
	import type { FoodMacros } from '$lib/types';

	interface Props {
		current: FoodMacros;
		target: FoodMacros;
	}

	const { current, target }: Props = $props();

	function pct(c: number, t: number): number {
		if (t <= 0) return 0;
		return Math.min(100, Math.round((c / t) * 100));
	}

	const rows = $derived([
		{ label: 'Protein', unit: 'g', current: current.protein, target: target.protein, accent: 'bg-accent' },
		{ label: 'Calories', unit: 'kcal', current: current.kcal, target: target.kcal, accent: 'bg-accent/70' },
		{ label: 'Carbs', unit: 'g', current: current.carbs, target: target.carbs, accent: 'bg-accent/50' },
		{ label: 'Fat', unit: 'g', current: current.fat, target: target.fat, accent: 'bg-accent/40' },
	]);
</script>

<div class="space-y-3">
	{#each rows as r}
		<div>
			<div class="flex justify-between text-sm mb-1">
				<span class="text-text-secondary">{r.label}</span>
				<span class="text-text-primary font-medium">
					{r.current} / {r.target} {r.unit}
				</span>
			</div>
			<div class="h-2 rounded-full bg-surface-hover overflow-hidden">
				<div
					class="h-full {r.accent} transition-all duration-300"
					style="width: {pct(r.current, r.target)}%"
				></div>
			</div>
		</div>
	{/each}
</div>
