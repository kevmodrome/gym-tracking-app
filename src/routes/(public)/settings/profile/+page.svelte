<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Card, NumberSpinner, PageHeader, Select } from '$lib/ui';
	import { nutritionProfileStore } from '$lib/stores/nutritionProfile.svelte';
	import { computeTargets } from '$lib/nutrition/targets';
	import { latestWeightKg, upsertWeightForDate } from '$lib/nutrition/db';
	import { todayString } from '$lib/nutrition/dates';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { ActivityLevel, FoodMacros, NutritionGoal, Sex } from '$lib/types';

	let kg = $state<number>(80);
	let saving = $state(false);

	onMount(async () => {
		await nutritionProfileStore.load();
		const w = await latestWeightKg();
		if (w !== null) kg = w;
	});

	const targets = $derived(computeTargets(nutritionProfileStore.snapshot(), kg));

	const sexOptions: { value: Sex; label: string }[] = [
		{ value: 'male', label: 'Male' },
		{ value: 'female', label: 'Female' },
	];
	const activityOptions: { value: ActivityLevel; label: string }[] = [
		{ value: 'sedentary', label: 'Sedentary' },
		{ value: 'light', label: 'Light' },
		{ value: 'moderate', label: 'Moderate' },
		{ value: 'active', label: 'Active' },
		{ value: 'very_active', label: 'Very active' },
	];
	const goalOptions: { value: NutritionGoal; label: string }[] = [
		{ value: 'cut', label: 'Cut (-500 kcal)' },
		{ value: 'maintain', label: 'Maintain' },
		{ value: 'bulk', label: 'Bulk (+300 kcal)' },
	];

	type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat';
	const macroFields: { key: MacroKey; label: string; unit: string; step: number }[] = [
		{ key: 'kcal', label: 'Calories', unit: 'kcal', step: 50 },
		{ key: 'protein', label: 'Protein', unit: 'g', step: 5 },
		{ key: 'carbs', label: 'Carbs', unit: 'g', step: 5 },
		{ key: 'fat', label: 'Fat', unit: 'g', step: 5 },
	];

	function override(key: MacroKey, value: number) {
		const next: Partial<FoodMacros> = { ...nutritionProfileStore.manualOverrides };
		if (Number.isNaN(value)) delete next[key];
		else next[key] = value;
		nutritionProfileStore.manualOverrides = next;
	}

	function clearOverride(key: MacroKey) {
		const next: Partial<FoodMacros> = { ...nutritionProfileStore.manualOverrides };
		delete next[key];
		nutritionProfileStore.manualOverrides = next;
	}

	async function save() {
		saving = true;
		try {
			await nutritionProfileStore.save();
			await upsertWeightForDate(todayString(), kg);
			toastStore.showSuccess('Profile saved');
		} catch (e) {
			console.error(e);
			toastStore.showError('Failed to save profile');
		} finally {
			saving = false;
		}
	}
</script>

<div class="min-h-screen bg-bg p-4 md:p-8">
	<div class="max-w-2xl mx-auto">
		<PageHeader title="Profile & Targets" />

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Body</h2>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<NumberSpinner bind:value={nutritionProfileStore.heightCm} label="Height (cm)" min={120} max={230} step={1} />
					<NumberSpinner bind:value={nutritionProfileStore.age} label="Age" min={10} max={100} step={1} />
					<div class="sm:col-span-2">
						<NumberSpinner bind:value={kg} label="Weight today (kg)" min={30} max={250} step={0.1} />
					</div>
					<Select bind:value={nutritionProfileStore.sex} options={sexOptions} label="Sex" />
					<Select bind:value={nutritionProfileStore.activityLevel} options={activityOptions} label="Activity" />
					<div class="sm:col-span-2">
						<Select bind:value={nutritionProfileStore.goal} options={goalOptions} label="Goal" />
					</div>
					<div class="sm:col-span-2">
						<NumberSpinner bind:value={nutritionProfileStore.proteinPerKg} label="Protein (g per kg bodyweight)" min={1.2} max={3.0} step={0.1} />
					</div>
				</div>
			{/snippet}
		</Card>

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-2">Computed daily targets</h2>
				<p class="text-sm text-text-secondary mb-4">Override any value to lock it; clear to recompute.</p>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{#each macroFields as f}
						{@const overridden = nutritionProfileStore.manualOverrides[f.key] !== undefined}
						<div>
							<NumberSpinner
								value={nutritionProfileStore.manualOverrides[f.key] ?? targets[f.key]}
								onchange={(v) => override(f.key, v)}
								label="{f.label} ({f.unit})"
								min={0}
								step={f.step}
							/>
							{#if overridden}
								<button type="button" onclick={() => clearOverride(f.key)} class="text-xs text-accent mt-1">
									Reset to computed
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/snippet}
		</Card>

		<Button onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
	</div>
</div>
