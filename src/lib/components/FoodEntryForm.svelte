<script lang="ts">
	import NumberSpinner from '$lib/ui/NumberSpinner.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { macrosFromGrams } from '$lib/nutrition/targets';
	import type { FoodMacros } from '$lib/types';

	interface Props {
		name: string;
		per100g: FoodMacros;
		initialGrams?: number;
		initialNote?: string;
		submitLabel?: string;
		onSubmit: (args: { grams: number; note?: string; macros: FoodMacros }) => void;
		onCancel?: () => void;
	}

	let {
		name,
		per100g,
		initialGrams = 100,
		initialNote = '',
		submitLabel = 'Add',
		onSubmit,
		onCancel,
	}: Props = $props();

	let grams = $state<number>(initialGrams);
	let note = $state<string>(initialNote);

	const macros = $derived(macrosFromGrams(per100g, grams));

	function submit() {
		if (grams <= 0) return;
		onSubmit({ grams, note: note || undefined, macros });
	}
</script>

<div class="space-y-4">
	<div>
		<div class="text-sm text-text-secondary">Food</div>
		<div class="text-base text-text-primary font-medium">{name}</div>
	</div>

	<div>
		<label for="grams-input" class="block text-sm text-text-secondary mb-1">Grams</label>
		<NumberSpinner id="grams-input" bind:value={grams} min={1} step={10} />
	</div>

	<div class="grid grid-cols-4 gap-2 text-center text-sm">
		<div><div class="text-text-secondary">kcal</div><div class="font-medium">{macros.kcal}</div></div>
		<div><div class="text-text-secondary">P</div><div class="font-medium">{macros.protein}g</div></div>
		<div><div class="text-text-secondary">C</div><div class="font-medium">{macros.carbs}g</div></div>
		<div><div class="text-text-secondary">F</div><div class="font-medium">{macros.fat}g</div></div>
	</div>

	<div>
		<label for="note-input" class="block text-sm text-text-secondary mb-1">Note (optional)</label>
		<TextInput id="note-input" bind:value={note} />
	</div>

	<div class="flex gap-2 justify-end">
		{#if onCancel}
			<Button variant="ghost" onclick={onCancel}>Cancel</Button>
		{/if}
		<Button onclick={submit} disabled={grams <= 0}>{submitLabel}</Button>
	</div>
</div>
