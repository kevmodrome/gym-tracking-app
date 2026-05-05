<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Trash2 } from 'lucide-svelte';
	import { Button, Card, Modal, NumberSpinner, PageHeader, TextInput } from '$lib/ui';
	import DateNavigator from '$lib/components/DateNavigator.svelte';
	import MacroRings from '$lib/components/MacroRings.svelte';
	import FoodEntryForm from '$lib/components/FoodEntryForm.svelte';
	import {
		addEntry,
		dailyTotals,
		deleteEntry,
		latestWeightKg,
		listEntriesForDate,
	} from '$lib/nutrition/db';
	import { computeTargets } from '$lib/nutrition/targets';
	import { nutritionProfileStore } from '$lib/stores/nutritionProfile.svelte';
	import { todayString } from '$lib/nutrition/dates';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { FoodEntry, FoodMacros } from '$lib/types';

	type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat';

	let date = $state<string>(todayString());
	let entries = $state<FoodEntry[]>([]);
	let totals = $state<FoodMacros>({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
	let kg = $state<number>(80);

	let manualOpen = $state(false);
	let manualName = $state('');
	let manualPer100g = $state<FoodMacros>({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

	const targets = $derived(computeTargets(nutritionProfileStore.snapshot(), kg));

	async function refresh() {
		entries = await listEntriesForDate(date);
		totals = await dailyTotals(date);
	}

	$effect(() => {
		void date;
		refresh();
	});

	onMount(async () => {
		await nutritionProfileStore.load();
		const w = await latestWeightKg();
		if (w !== null) kg = w;
	});

	function setManualMacro(key: MacroKey, value: number) {
		manualPer100g = { ...manualPer100g, [key]: value };
	}

	function resetManual() {
		manualName = '';
		manualPer100g = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
	}

	async function saveManual({ grams, note, macros }: { grams: number; note?: string; macros: FoodMacros }) {
		if (!manualName.trim()) {
			toastStore.showError('Enter a food name');
			return;
		}
		await addEntry({
			date,
			loggedAt: new Date().toISOString(),
			inlineFood: { name: manualName.trim(), per100g: manualPer100g },
			grams,
			macros,
			note,
		});
		manualOpen = false;
		resetManual();
		await refresh();
		toastStore.showSuccess('Entry added');
	}

	async function remove(entry: FoodEntry) {
		await deleteEntry(entry.id);
		await refresh();
	}

	function entryName(e: FoodEntry): string {
		return e.inlineFood?.name ?? 'Saved food';
	}

	const macroFields: { key: MacroKey; label: string }[] = [
		{ key: 'kcal', label: 'kcal' },
		{ key: 'protein', label: 'P' },
		{ key: 'carbs', label: 'C' },
		{ key: 'fat', label: 'F' },
	];
</script>

<div class="min-h-screen bg-bg p-4 md:p-8">
	<div class="max-w-2xl mx-auto space-y-4 pb-24">
		<PageHeader title="Log" />

		<DateNavigator {date} onChange={(d) => date = d} />

		<Card>
			{#snippet children()}
				<MacroRings current={totals} target={targets} />
			{/snippet}
		</Card>

		<div class="flex justify-end">
			<Button onclick={() => { manualOpen = true; }}>
				<Plus class="w-4 h-4" /> Add entry
			</Button>
		</div>

		<Card>
			{#snippet children()}
				{#if entries.length === 0}
					<p class="text-sm text-text-secondary text-center py-6">No entries for this day yet.</p>
				{:else}
					<ul class="divide-y divide-border">
						{#each entries as entry (entry.id)}
							<li class="flex items-center justify-between py-3">
								<div>
									<div class="text-text-primary font-medium">{entryName(entry)}</div>
									<div class="text-xs text-text-secondary">
										{entry.grams}g · {entry.macros.kcal}kcal · {entry.macros.protein}g P
										{#if entry.note}· {entry.note}{/if}
									</div>
								</div>
								<button
									type="button"
									class="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"
									onclick={() => remove(entry)}
									aria-label="Delete entry"
								>
									<Trash2 class="w-4 h-4" />
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/snippet}
		</Card>
	</div>
</div>

<Modal
	open={manualOpen}
	title="Add food (manual)"
	onclose={() => { manualOpen = false; }}
>
	{#snippet children()}
		<div class="space-y-4">
			<label class="block">
				<span class="block text-sm text-text-secondary mb-1">Name</span>
				<TextInput bind:value={manualName} />
			</label>
			<div class="grid grid-cols-4 gap-2">
				{#each macroFields as f}
					<NumberSpinner
						value={manualPer100g[f.key]}
						onchange={(v) => setManualMacro(f.key, v)}
						label="{f.label}/100g"
						min={0}
						step={1}
						size="sm"
					/>
				{/each}
			</div>
			<FoodEntryForm
				name={manualName || 'New food'}
				per100g={manualPer100g}
				submitLabel="Add"
				onSubmit={saveManual}
				onCancel={() => { manualOpen = false; resetManual(); }}
			/>
		</div>
	{/snippet}
</Modal>
