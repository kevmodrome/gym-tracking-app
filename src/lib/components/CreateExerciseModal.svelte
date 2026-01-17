<script lang="ts">
	import Dexie from 'dexie';
	import { db } from '$lib/db';
	import type { Exercise, ExerciseCategory, MuscleGroup } from '$lib/types';
	import { syncManager } from '$lib/syncUtils';
	import XIcon from '$lib/components/XIcon.svelte';
	import { Button, Modal, TextInput, Select, InfoBox } from '$lib/ui';

	let { onCreate, onClose } = $props<{
		onCreate: (exercise: Exercise) => void;
		onClose: () => void;
	}>();

	let name = $state('');
	let category = $state<ExerciseCategory | ''>('');
	let primaryMuscle = $state<MuscleGroup | ''>('');
	let secondaryMuscles = $state<string[]>([]);
	let newSecondaryMuscle = $state('');
	let equipment = $state('');

	const categories: ExerciseCategory[] = ['compound', 'isolation', 'cardio', 'mobility'];
	const muscles: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full-body'];

	const categoryOptions = [
		{ value: '', label: 'Select category' },
		...categories.map(c => ({ value: c, label: formatLabel(c) }))
	];

	const muscleOptions = [
		{ value: '', label: 'Select primary muscle group' },
		...muscles.map(m => ({ value: m, label: formatLabel(m) }))
	];

	let validationError = $derived.by(() => {
		if (!name.trim()) return 'Exercise name is required';
		if (!category) return 'Category is required';
		if (!primaryMuscle) return 'Primary muscle group is required';
		return '';
	});

	const isFormValid = $derived(() => {
		return !!name.trim() && !!category && !!primaryMuscle;
	});

	function addSecondaryMuscle() {
		const muscle = newSecondaryMuscle.trim().toLowerCase();
		if (muscle && !secondaryMuscles.includes(muscle)) {
			secondaryMuscles = [...secondaryMuscles, muscle];
			newSecondaryMuscle = '';
		}
	}

	function removeSecondaryMuscle(index: number) {
		secondaryMuscles = secondaryMuscles.filter((_, i) => i !== index);
	}

	async function handleSubmit() {
		if (!isFormValid) return;

		const newExercise: Exercise = {
			id: Date.now().toString(),
			name: name.trim(),
			category: category as ExerciseCategory,
			primary_muscle: primaryMuscle as MuscleGroup,
			secondary_muscles: secondaryMuscles,
			equipment: equipment.trim(),
			is_custom: true
		};

		await db.exercises.add(Dexie.deepClone(newExercise));
		await syncManager.addToSyncQueue('exercise', newExercise.id, 'create', Dexie.deepClone(newExercise));
		onCreate(newExercise);
		onClose();
	}

	function formatLabel(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
</script>

<Modal open={true} title="Create Custom Exercise" size="lg" onclose={onClose}>
	{#snippet children()}
		<div class="space-y-4">
			{#if validationError}
				<InfoBox variant="error">
					{validationError}
				</InfoBox>
			{/if}

			<TextInput
				label="Exercise Name *"
				bind:value={name}
				placeholder="e.g., Incline Barbell Bench Press"
				autofocus
			/>

			<Select
				label="Category *"
				bind:value={category}
				options={categoryOptions}
			/>

			<Select
				label="Primary Muscle Group *"
				bind:value={primaryMuscle}
				options={muscleOptions}
			/>

			<fieldset class="border-none p-0 m-0">
				<legend class="text-sm font-medium text-gray-700 mb-2 block">Secondary Muscle Groups</legend>
				<div class="flex gap-2 mb-2">
					<input
						type="text"
						bind:value={newSecondaryMuscle}
						onkeypress={(e) => e.key === 'Enter' && (addSecondaryMuscle(), e.preventDefault())}
						placeholder="e.g., triceps (press Enter to add)"
						class="flex-1 px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
					/>
					<Button
						variant="secondary"
						onclick={addSecondaryMuscle}
						disabled={!newSecondaryMuscle.trim()}
					>
						Add
					</Button>
				</div>
				{#if secondaryMuscles.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each secondaryMuscles as muscle, index}
							<span
								class="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-800 rounded-full text-sm min-h-[36px]"
							>
								{muscle}
								<button
									onclick={() => removeSecondaryMuscle(index)}
									class="ml-1 p-1 text-gray-500 hover:text-gray-700 min-w-[28px] min-h-[28px] rounded-full hover:bg-gray-200"
									type="button"
									aria-label={`Remove ${muscle}`}
								>
									<XIcon class="w-3 h-3" />
								</button>
							</span>
						{/each}
					</div>
				{/if}
			</fieldset>

			<TextInput
				label="Equipment (optional)"
				bind:value={equipment}
				placeholder="e.g., Barbell, Dumbbells, Cable Machine"
			/>
		</div>
	{/snippet}
	{#snippet footer()}
		<Button variant="ghost" onclick={onClose}>
			Cancel
		</Button>
		<Button variant="primary" onclick={handleSubmit} disabled={!isFormValid}>
			Create Exercise
		</Button>
	{/snippet}
</Modal>
