<script lang="ts">
	import Dexie from 'dexie';
	import { db } from '$lib/db';
	import type { Exercise, ExerciseCategory, MuscleGroup } from '$lib/types';
	import { syncManager } from '$lib/syncUtils';
	import XIcon from '$lib/components/XIcon.svelte';

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

<div
	class="fixed inset-0 bg-black-50 bg-opacity-50 flex items-center justify-center p-4 z-50"
	role="dialog"
	aria-modal="true"
	aria-labelledby="modal-title"
	tabindex="-1"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		role="document"
		class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="flex items-center justify-between mb-6">
			<h2 id="modal-title" class="text-2xl font-bold text-gray-900">Create Custom Exercise</h2>
			<button
				onclick={onClose}
				class="p-2 hover:bg-gray-100 rounded-full transition-colors"
				type="button"
			>
				<XIcon class="w-6 h-6 text-gray-500" />
			</button>
		</div>

		<div class="space-y-4">
			{#if validationError}
				<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
					{validationError}
				</div>
			{/if}

			<div>
				<label for="exercise-name" class="block text-sm font-medium text-gray-700 mb-2">
					Exercise Name *
				</label>
				<input
					id="exercise-name"
					type="text"
					bind:value={name}
					placeholder="e.g., Incline Barbell Bench Press"
					autofocus
					class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
				/>
			</div>

			<div>
				<label for="category" class="block text-sm font-medium text-gray-700 mb-2">
					Category *
				</label>
				<select
					id="category"
					bind:value={category}
					class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
				>
					<option value="">Select category</option>
					{#each categories as cat}
						<option value={cat}>{formatLabel(cat)}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="primary-muscle" class="block text-sm font-medium text-gray-700 mb-2">
					Primary Muscle Group *
				</label>
				<select
					id="primary-muscle"
					bind:value={primaryMuscle}
					class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
				>
					<option value="">Select primary muscle group</option>
					{#each muscles as muscle}
						<option value={muscle}>{formatLabel(muscle)}</option>
					{/each}
				</select>
			</div>

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
					<button
						onclick={addSecondaryMuscle}
						disabled={!newSecondaryMuscle.trim()}
						type="button"
						class="px-4 py-3 text-base bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[80px]"
					>
						Add
					</button>
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

			<div>
				<label for="equipment" class="block text-sm font-medium text-gray-700 mb-2">
					Equipment (optional)
				</label>
				<input
					id="equipment"
					type="text"
					bind:value={equipment}
					placeholder="e.g., Barbell, Dumbbells, Cable Machine"
					class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
				/>
			</div>
		</div>

		<div class="flex gap-3 mt-6 pt-6 border-t border-gray-200">
			<button
				onclick={onClose}
				type="button"
				class="flex-1 px-4 py-3 text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
			>
				Cancel
			</button>
			<button
				onclick={handleSubmit}
				disabled={!isFormValid}
				type="button"
				class="flex-1 px-4 py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
			>
				Create Exercise
			</button>
		</div>
	</div>
</div>
