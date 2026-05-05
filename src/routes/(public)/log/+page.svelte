<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Camera, Plus, Trash2 } from 'lucide-svelte';
	import { Button, Card, Modal, NumberSpinner, PageHeader, TextInput, Toggle } from '$lib/ui';
	import DateNavigator from '$lib/components/DateNavigator.svelte';
	import MacroRings from '$lib/components/MacroRings.svelte';
	import FoodEntryForm from '$lib/components/FoodEntryForm.svelte';
	import FoodSearch from '$lib/components/FoodSearch.svelte';
	import {
		addEntry,
		addFood,
		dailyTotals,
		deleteEntry,
		getFoodById,
		latestWeightKg,
		listEntriesForDate,
		touchFood,
		updateEntry,
	} from '$lib/nutrition/db';
	import { computeTargets } from '$lib/nutrition/targets';
	import { nutritionProfileStore } from '$lib/stores/nutritionProfile.svelte';
	import { todayString } from '$lib/nutrition/dates';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { PickedFood } from '$lib/nutrition/picked';
	import type { FoodEntry, FoodMacros } from '$lib/types';

	type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat';
	type AddMode = 'search' | 'manual';

	let date = $state<string>(todayString());
	let entries = $state<FoodEntry[]>([]);
	let totals = $state<FoodMacros>({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
	let kg = $state<number>(80);
	let nameById = $state<Map<string, string>>(new Map());

	let addOpen = $state(false);
	let mode = $state<AddMode>('search');
	let pickedName = $state('');
	let pickedPer100g = $state<FoodMacros>({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
	let pickedFoodId = $state<string | undefined>(undefined);
	let pickedLivsId = $state<string | undefined>(undefined);
	let saveToLibrary = $state<boolean>(true);

	let pendingOffBarcode = $state<string | undefined>(undefined);

	let editEntry = $state<FoodEntry | null>(null);

	function startEdit(e: FoodEntry) {
		editEntry = e;
	}

	function editPer100g(e: FoodEntry): FoodMacros {
		if (e.inlineFood) return e.inlineFood.per100g;
		// Re-derive per100g by scaling the entry's macros snapshot back to 100g.
		// Loses some precision due to integer rounding but is acceptable for an edit form.
		if (e.grams <= 0) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
		const factor = 100 / e.grams;
		return {
			kcal: Math.round(e.macros.kcal * factor),
			protein: Math.round(e.macros.protein * factor * 10) / 10,
			carbs: Math.round(e.macros.carbs * factor * 10) / 10,
			fat: Math.round(e.macros.fat * factor * 10) / 10,
		};
	}

	async function saveEdit({ grams, note, macros }: { grams: number; note?: string; macros: FoodMacros }) {
		if (!editEntry) return;
		await updateEntry(editEntry.id, { grams, macros, note });
		editEntry = null;
		await refresh();
		toastStore.showSuccess('Entry updated');
	}

	const HANDOFF_KEY = 'gym-app-scan-handoff';

	const targets = $derived(computeTargets(nutritionProfileStore.snapshot(), kg));

	async function refresh() {
		const [list, dailySum] = await Promise.all([
			listEntriesForDate(date),
			dailyTotals(date),
		]);
		entries = list;
		totals = dailySum;
		const ids = [...new Set(list.map((e) => e.foodId).filter((x): x is string => Boolean(x)))];
		const map = new Map<string, string>();
		for (const id of ids) {
			const f = await getFoodById(id);
			if (f) map.set(id, f.name);
		}
		nameById = map;
	}

	$effect(() => {
		void date;
		refresh();
	});

	type Handoff =
		| { kind: 'saved'; foodId: string; name: string; per100g: FoodMacros }
		| { kind: 'off'; barcode: string; name: string; brand?: string; per100g: FoodMacros }
		| { kind: 'manual'; barcode: string };

	function openFromHandoff(data: Handoff) {
		addOpen = true;
		if (data.kind === 'saved') {
			mode = 'search';
			pickedName = data.name;
			pickedPer100g = data.per100g;
			pickedFoodId = data.foodId;
			pickedLivsId = undefined;
			pendingOffBarcode = undefined;
		} else if (data.kind === 'off') {
			mode = 'search';
			pickedName = data.name;
			pickedPer100g = data.per100g;
			pickedFoodId = undefined;
			pickedLivsId = undefined;
			pendingOffBarcode = data.barcode;
		} else {
			mode = 'manual';
			pickedName = `Barcode ${data.barcode}`;
			pickedPer100g = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
			pickedFoodId = undefined;
			pickedLivsId = undefined;
			pendingOffBarcode = data.barcode;
		}
	}

	onMount(async () => {
		await nutritionProfileStore.load();
		const w = await latestWeightKg();
		if (w !== null) kg = w;

		const handoff = sessionStorage.getItem(HANDOFF_KEY);
		if (handoff) {
			sessionStorage.removeItem(HANDOFF_KEY);
			try {
				const data = JSON.parse(handoff) as Handoff;
				openFromHandoff(data);
			} catch {
				// ignore malformed handoff
			}
		}
	});

	function resetPick() {
		pickedName = '';
		pickedPer100g = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
		pickedFoodId = undefined;
		pickedLivsId = undefined;
		pendingOffBarcode = undefined;
	}

	function openAdd() {
		addOpen = true;
		mode = 'search';
		resetPick();
	}

	function closeAdd() {
		addOpen = false;
		resetPick();
	}

	function setManualMacro(key: MacroKey, value: number) {
		pickedPer100g = { ...pickedPer100g, [key]: value };
	}

	function onSearchPick(picked: PickedFood) {
		pickedName = picked.name;
		pickedPer100g = picked.per100g;
		pickedFoodId = picked.savedFoodId;
		pickedLivsId = picked.livsId;
	}

	async function onSearchSubmit({ grams, note, macros }: { grams: number; note?: string; macros: FoodMacros }) {
		let foodId = pickedFoodId;
		if (!foodId && pendingOffBarcode) {
			foodId = await addFood({
				source: 'off',
				barcode: pendingOffBarcode,
				name: pickedName,
				per100g: pickedPer100g,
				lastUsedAt: new Date().toISOString(),
				createdAt: new Date().toISOString(),
			});
		} else if (!foodId && pickedLivsId) {
			foodId = await addFood({
				source: 'livs',
				externalId: pickedLivsId,
				name: pickedName,
				per100g: pickedPer100g,
				lastUsedAt: new Date().toISOString(),
				createdAt: new Date().toISOString(),
			});
		} else if (foodId) {
			await touchFood(foodId);
		}
		await addEntry({
			date,
			loggedAt: new Date().toISOString(),
			foodId,
			grams,
			macros,
			note,
		});
		closeAdd();
		await refresh();
		toastStore.showSuccess('Entry added');
	}

	async function onManualSubmit({ grams, note, macros }: { grams: number; note?: string; macros: FoodMacros }) {
		if (!pickedName.trim()) {
			toastStore.showError('Enter a food name');
			return;
		}
		let foodId: string | undefined;
		if (saveToLibrary) {
			foodId = await addFood({
				source: 'custom',
				barcode: pendingOffBarcode,
				name: pickedName.trim(),
				per100g: pickedPer100g,
				lastUsedAt: new Date().toISOString(),
				createdAt: new Date().toISOString(),
			});
		}
		await addEntry({
			date,
			loggedAt: new Date().toISOString(),
			foodId,
			inlineFood: foodId ? undefined : { name: pickedName.trim(), per100g: pickedPer100g },
			grams,
			macros,
			note,
		});
		closeAdd();
		await refresh();
		toastStore.showSuccess('Entry added');
	}

	async function remove(entry: FoodEntry) {
		await deleteEntry(entry.id);
		await refresh();
	}

	function entryName(e: FoodEntry): string {
		if (e.foodId) return nameById.get(e.foodId) ?? 'Saved food';
		return e.inlineFood?.name ?? 'Entry';
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

		<div class="flex justify-end gap-2">
			<Button variant="ghost" onclick={() => goto('/log/scan')}>
				<Camera class="w-4 h-4" /> Scan
			</Button>
			<Button onclick={openAdd}>
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
								<button type="button" class="flex-1 text-left" onclick={() => startEdit(entry)}>
									<div class="text-text-primary font-medium">{entryName(entry)}</div>
									<div class="text-xs text-text-secondary">
										{entry.grams}g · {entry.macros.kcal}kcal · {entry.macros.protein}g P
										{#if entry.note}· {entry.note}{/if}
									</div>
								</button>
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

<Modal open={addOpen} title="Add food" onclose={closeAdd}>
	{#snippet children()}
		<div class="space-y-4">
			<div class="flex gap-2 text-sm">
				<button
					type="button"
					class="px-3 py-1 rounded-lg {mode === 'search' ? 'bg-accent text-bg' : 'bg-surface'}"
					onclick={() => { mode = 'search'; resetPick(); }}
				>
					Search
				</button>
				<button
					type="button"
					class="px-3 py-1 rounded-lg {mode === 'manual' ? 'bg-accent text-bg' : 'bg-surface'}"
					onclick={() => { mode = 'manual'; resetPick(); }}
				>
					Manual
				</button>
			</div>

			{#if mode === 'search'}
				{#if !pickedName}
					<FoodSearch onPick={onSearchPick} />
				{:else}
					<FoodEntryForm
						name={pickedName}
						per100g={pickedPer100g}
						submitLabel="Add"
						onSubmit={onSearchSubmit}
						onCancel={resetPick}
					/>
				{/if}
			{:else}
				<label class="block">
					<span class="block text-sm text-text-secondary mb-1">Name</span>
					<TextInput bind:value={pickedName} />
				</label>
				<div class="grid grid-cols-4 gap-2">
					{#each macroFields as f}
						<NumberSpinner
							value={pickedPer100g[f.key]}
							onchange={(v) => setManualMacro(f.key, v)}
							label="{f.label}/100g"
							min={0}
							step={1}
							size="sm"
						/>
					{/each}
				</div>
				<Toggle bind:checked={saveToLibrary} label="Save to library" />
				<FoodEntryForm
					name={pickedName || 'New food'}
					per100g={pickedPer100g}
					submitLabel="Add"
					onSubmit={onManualSubmit}
					onCancel={closeAdd}
				/>
			{/if}
		</div>
	{/snippet}
</Modal>

<Modal
	open={editEntry !== null}
	title="Edit entry"
	onclose={() => editEntry = null}
>
	{#snippet children()}
		{#if editEntry}
			<FoodEntryForm
				name={entryName(editEntry)}
				per100g={editPer100g(editEntry)}
				initialGrams={editEntry.grams}
				initialNote={editEntry.note ?? ''}
				submitLabel="Save"
				onSubmit={saveEdit}
				onCancel={() => editEntry = null}
			/>
		{/if}
	{/snippet}
</Modal>
