<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Card, NumberSpinner } from '$lib/ui';
	import WeightChart from '$lib/components/WeightChart.svelte';
	import { listWeights, upsertWeightForDate, latestWeightKg } from '$lib/nutrition/db';
	import { todayString } from '$lib/nutrition/dates';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { Weight } from '$lib/types';

	let kg = $state<number>(80);
	let weights = $state<Weight[]>([]);

	onMount(async () => {
		weights = await listWeights();
		const w = await latestWeightKg();
		if (w !== null) kg = w;
	});

	async function save() {
		await upsertWeightForDate(todayString(), kg);
		weights = await listWeights();
		toastStore.showSuccess('Weight saved');
	}
</script>

<div class="max-w-2xl mx-auto space-y-4 pb-24">
	<Card>
		{#snippet children()}
			<h2 class="text-lg font-semibold text-text-primary mb-3">Today's weight</h2>
			<div class="flex items-end gap-3">
				<div class="flex-1">
					<NumberSpinner bind:value={kg} label="Weight (kg)" min={30} max={250} step={0.1} />
				</div>
				<Button onclick={save}>Save</Button>
			</div>
		{/snippet}
	</Card>
	<Card>
		{#snippet children()}
			<WeightChart data={weights} />
		{/snippet}
	</Card>
</div>
