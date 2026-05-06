<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Apple, Droplet, Drumstick, Flame, Minus, Plus, Star, Trash2, Wheat } from 'lucide-svelte';
	import { Button, Card, EmptyState, Modal, NumberSpinner, PageHeader, TextInput, Toggle } from '$lib/ui';
	import { ScannerMark } from '$lib/icons';
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
		getWaterForDate,
		incrementWaterForDate,
		latestWeightKg,
		listEntriesForDate,
		listFavoriteFoods,
		listRecentFoods,
		setFoodFavorite,
		touchFood,
		updateEntry,
		type RecentFoodPick,
	} from '$lib/nutrition/db';
	import { computeTargets } from '$lib/nutrition/targets';
	import { nutritionProfileStore } from '$lib/stores/nutritionProfile.svelte';
	import { todayString } from '$lib/nutrition/dates';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { PickedFood } from '$lib/nutrition/picked';
	import type { Food, FoodEntry, FoodMacros } from '$lib/types';

	type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat';
	type AddMode = 'search' | 'manual';

	let date = $state<string>(todayString());
	let entries = $state<FoodEntry[]>([]);
	let totals = $state<FoodMacros>({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
	let kg = $state<number>(80);
	let nameById = $state<Map<string, string>>(new Map());
	let recents = $state<RecentFoodPick[]>([]);
	let favorites = $state<Food[]>([]);
	let waterCount = $state<number>(0);

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
		await updateEntry(editEntry.id, $state.snapshot({ grams, macros, note }) as Partial<FoodEntry>);
		editEntry = null;
		await refresh();
		toastStore.showSuccess('Entry updated');
	}

	const HANDOFF_KEY = 'gym-app-scan-handoff';

	const targets = $derived(computeTargets(nutritionProfileStore.snapshot(), kg));
	const hasEntries = $derived(entries.length > 0);

	async function refresh() {
		const [list, dailySum, water, recentList, favList] = await Promise.all([
			listEntriesForDate(date),
			dailyTotals(date),
			getWaterForDate(date),
			listRecentFoods(date, 20),
			listFavoriteFoods(20),
		]);
		entries = list;
		totals = dailySum;
		waterCount = water?.count ?? 0;
		recents = recentList;
		favorites = favList;
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

	function pickRecent(r: RecentFoodPick) {
		addOpen = true;
		mode = 'search';
		pickedName = r.name;
		pickedPer100g = r.per100g;
		pickedFoodId = r.foodId;
		pickedLivsId = undefined;
		pendingOffBarcode = undefined;
	}

	function pickFavorite(f: Food) {
		addOpen = true;
		mode = 'search';
		pickedName = f.name;
		pickedPer100g = f.per100g;
		pickedFoodId = f.id;
		pickedLivsId = undefined;
		pendingOffBarcode = undefined;
	}

	async function toggleRecentFavorite(r: RecentFoodPick, e: Event) {
		e.stopPropagation();
		if (!r.foodId) {
			toastStore.showError('Save this food to your library to favorite it');
			return;
		}
		const next = !(r.favorite ?? false);
		await setFoodFavorite(r.foodId, next);
		await refresh();
	}

	async function toggleFavorite(f: Food, e: Event) {
		e.stopPropagation();
		const next = !(f.favorite ?? false);
		await setFoodFavorite(f.id, next);
		await refresh();
	}

	async function addWater() {
		waterCount = await incrementWaterForDate(date, 1);
	}

	async function removeWater() {
		if (waterCount <= 0) return;
		waterCount = await incrementWaterForDate(date, -1);
	}

	async function onSearchSubmit({ grams, note, macros }: { grams: number; note?: string; macros: FoodMacros }) {
		let foodId = pickedFoodId;
		if (!foodId && pendingOffBarcode) {
			foodId = await addFood($state.snapshot({
				source: 'off',
				barcode: pendingOffBarcode,
				name: pickedName,
				per100g: pickedPer100g,
				lastUsedAt: new Date().toISOString(),
				createdAt: new Date().toISOString(),
			}) as Omit<Food, 'id'>);
		} else if (!foodId && pickedLivsId) {
			foodId = await addFood($state.snapshot({
				source: 'livs',
				externalId: pickedLivsId,
				name: pickedName,
				per100g: pickedPer100g,
				lastUsedAt: new Date().toISOString(),
				createdAt: new Date().toISOString(),
			}) as Omit<Food, 'id'>);
		} else if (foodId) {
			await touchFood(foodId);
		}
		await addEntry($state.snapshot({
			date,
			loggedAt: new Date().toISOString(),
			foodId,
			grams,
			macros,
			note,
		}) as Omit<FoodEntry, 'id'>);
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
			foodId = await addFood($state.snapshot({
				source: 'custom',
				barcode: pendingOffBarcode,
				name: pickedName.trim(),
				per100g: pickedPer100g,
				lastUsedAt: new Date().toISOString(),
				createdAt: new Date().toISOString(),
			}) as Omit<Food, 'id'>);
		}
		await addEntry($state.snapshot({
			date,
			loggedAt: new Date().toISOString(),
			foodId,
			inlineFood: foodId ? undefined : { name: pickedName.trim(), per100g: pickedPer100g },
			grams,
			macros,
			note,
		}) as Omit<FoodEntry, 'id'>);
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

	const macroFields = [
		{ key: 'kcal' as const, label: 'Calories (kcal/100g)', icon: Flame },
		{ key: 'protein' as const, label: 'Protein (g/100g)', icon: Drumstick },
		{ key: 'carbs' as const, label: 'Carbs (g/100g)', icon: Wheat },
		{ key: 'fat' as const, label: 'Fat (g/100g)', icon: Droplet },
	];
</script>

<div class="min-h-screen bg-bg p-4 md:p-8">
	<div class="max-w-2xl mx-auto space-y-4 pb-24">
		<PageHeader title="Fuel" />

		<DateNavigator {date} onChange={(d) => date = d} />

		<!-- Hero macro rings: focal lime kcal moment -->
		<Card>
			{#snippet children()}
				<div class="py-2">
					<MacroRings current={totals} target={targets} />
				</div>
			{/snippet}
		</Card>

		<!-- Quick water tracking row (low prominence) -->
		<div class="flex items-center justify-between gap-3 px-1">
			<div class="flex items-center gap-2 text-text-secondary text-sm">
				<Droplet class="w-4 h-4" />
				<span class="font-medium text-text-primary">Water</span>
				<span class="text-text-secondary">·</span>
				<span>{waterCount} {waterCount === 1 ? 'glass' : 'glasses'}</span>
				{#if waterCount > 0}
					<span class="text-text-muted text-xs">({waterCount * 250} ml)</span>
				{/if}
			</div>
			<div class="flex items-center gap-1">
				<button
					type="button"
					class="p-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-active disabled:opacity-40"
					onclick={removeWater}
					disabled={waterCount <= 0}
					aria-label="Remove water"
				>
					<Minus class="w-4 h-4" />
				</button>
				<button
					type="button"
					class="p-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-active"
					onclick={addWater}
					aria-label="Add water"
				>
					<Plus class="w-4 h-4" />
				</button>
			</div>
		</div>

		<!-- Primary action row: Scan (left, big) + Add food (right, big) -->
		<div class="grid grid-cols-2 gap-3">
			<Button variant="primary" size="lg" fullWidth onclick={() => goto('/log/scan')}>
				<ScannerMark size={22} />
				<span>Scan</span>
			</Button>
			<Button variant="secondary" size="lg" fullWidth onclick={openAdd}>
				<Plus class="w-5 h-5" />
				<span>Add food</span>
			</Button>
		</div>

		{#if !hasEntries && totals.kcal === 0}
			<!-- Empty state -->
			<Card>
				{#snippet children()}
					<EmptyState
						title="Start logging your meals"
						description="Scan a barcode or search for a food to begin."
						actionLabel="Scan barcode"
						actionHref="/log/scan"
					/>
					<div class="text-center pb-4 -mt-4">
						<button
							type="button"
							class="text-sm text-text-secondary underline hover:text-text-primary"
							onclick={openAdd}
						>
							Search food
						</button>
					</div>
				{/snippet}
			</Card>
		{:else}
			<!-- Today's entries -->
			<Card>
				{#snippet children()}
					<div class="flex items-center justify-between mb-2">
						<h2 class="font-display font-semibold text-text-primary">Today</h2>
						<span class="text-xs text-text-secondary">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
					</div>
					{#if entries.length === 0}
						<p class="text-sm text-text-secondary text-center py-4">No entries for this day yet.</p>
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
		{/if}

		<!-- Favorites: starred foods -->
		{#if favorites.length > 0}
			<section>
				<div class="flex items-center justify-between mb-2 px-1">
					<h2 class="text-xs uppercase tracking-wide text-text-secondary font-display">Favorites</h2>
				</div>
				<div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
					{#each favorites as f (f.id)}
						<div class="snap-start shrink-0 w-44 bg-surface border border-border rounded-xl hover:border-border-active transition flex items-start">
							<button
								type="button"
								class="flex-1 min-w-0 text-left p-3"
								onclick={() => pickFavorite(f)}
							>
								<div class="text-sm font-medium text-text-primary truncate">{f.name}</div>
								<div class="text-xs text-text-secondary truncate">
									{f.per100g.kcal} kcal · {f.per100g.protein}g P
								</div>
							</button>
							<button
								type="button"
								class="p-3 text-pr shrink-0"
								onclick={(e) => toggleFavorite(f, e)}
								aria-label="Unfavorite"
							>
								<Star class="w-4 h-4 fill-current" />
							</button>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Recents: most-recent unique foods -->
		{#if recents.length > 0}
			<section>
				<div class="flex items-center justify-between mb-2 px-1">
					<h2 class="text-xs uppercase tracking-wide text-text-secondary font-display">Recents</h2>
				</div>
				<div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
					{#each recents as r (r.key)}
						<div class="snap-start shrink-0 w-44 bg-surface border border-border rounded-xl hover:border-border-active transition flex items-start">
							<button
								type="button"
								class="flex-1 min-w-0 text-left p-3"
								onclick={() => pickRecent(r)}
							>
								<div class="text-sm font-medium text-text-primary truncate">{r.name}</div>
								<div class="text-xs text-text-secondary truncate">
									{r.per100g.kcal} kcal · {r.per100g.protein}g P
								</div>
							</button>
							{#if r.foodId}
								<button
									type="button"
									class="p-3 shrink-0 {r.favorite ? 'text-pr' : 'text-text-muted hover:text-text-secondary'}"
									onclick={(e) => toggleRecentFavorite(r, e)}
									aria-label={r.favorite ? 'Unfavorite' : 'Favorite'}
								>
									<Star class="w-4 h-4 {r.favorite ? 'fill-current' : ''}" />
								</button>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Onboarding hint when there is data but no recents/favorites yet -->
		{#if hasEntries && recents.length === 0 && favorites.length === 0}
			<div class="text-xs text-text-muted text-center px-2">
				<Apple class="w-4 h-4 inline-block mr-1 align-text-bottom" />
				Recents and favorites will appear here as you log meals.
			</div>
		{/if}
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
				<div class="grid grid-cols-2 gap-3">
					{#each macroFields as f}
						<div>
							<div class="flex items-center gap-2 text-sm text-text-secondary mb-1">
								<f.icon class="w-4 h-4 text-accent" />
								<span>{f.label}</span>
							</div>
							<NumberSpinner
								value={pickedPer100g[f.key]}
								onchange={(v) => setManualMacro(f.key, v)}
								min={0}
								step={1}
								size="sm"
							/>
						</div>
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
