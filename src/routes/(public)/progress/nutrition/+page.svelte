<script lang="ts">
	import { onMount } from 'svelte';
	import { Card } from '$lib/ui';
	import { dailyTotals, latestWeightKg } from '$lib/nutrition/db';
	import { addDays, formatDateLabel, todayString } from '$lib/nutrition/dates';
	import { computeTargets } from '$lib/nutrition/targets';
	import { nutritionProfileStore } from '$lib/stores/nutritionProfile.svelte';
	import type { FoodMacros } from '$lib/types';

	const DAYS = 14;
	let kg = $state<number>(80);
	let rows = $state<{ date: string; totals: FoodMacros }[]>([]);

	const targets = $derived(computeTargets(nutritionProfileStore.snapshot(), kg));

	onMount(async () => {
		await nutritionProfileStore.load();
		const w = await latestWeightKg();
		if (w !== null) kg = w;
		const today = todayString();
		const out: { date: string; totals: FoodMacros }[] = [];
		for (let i = 0; i < DAYS; i++) {
			const d = addDays(today, -i);
			out.push({ date: d, totals: await dailyTotals(d) });
		}
		rows = out;
	});

	function pct(c: number, t: number): number {
		if (t <= 0) return 0;
		return Math.min(100, Math.round((c / t) * 100));
	}
</script>

<div class="max-w-2xl mx-auto space-y-3 pb-24">
	{#each rows as row (row.date)}
		<Card>
			{#snippet children()}
				<div class="flex items-center justify-between mb-2">
					<div class="font-medium text-text-primary">{formatDateLabel(row.date)}</div>
					<div class="text-sm text-text-secondary">
						{row.totals.kcal} kcal · {Math.round(row.totals.protein)}g P
					</div>
				</div>
				<div class="h-2 rounded-full bg-surface-hover overflow-hidden">
					<div class="h-full bg-accent" style="width: {pct(row.totals.protein, targets.protein)}%"></div>
				</div>
			{/snippet}
		</Card>
	{/each}
</div>
