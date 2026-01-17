<script lang="ts">
	import Dexie from 'dexie';
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import type { Exercise, ExerciseRoutine, Workout } from '$lib/types';
	import { syncManager } from '$lib/syncUtils';
	import XIcon from '$lib/components/XIcon.svelte';
	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import ChevronUpIcon from '$lib/components/ChevronUpIcon.svelte';
	import ChevronDownIcon from '$lib/components/ChevronDownIcon.svelte';

	let { onClose, onWorkoutCreated } = $props<{
		onClose: () => void;
		onWorkoutCreated: (workout: Workout) => void;
	}>();

	let availableExercises = $state<Exercise[]>([]);
	let workoutName = $state('');
	let workoutExercises = $state<ExerciseRoutine[]>([]);
	let workoutNotes = $state('');
	let exerciseSearch = $state('');
	let selectedExercise = $state<Exercise | null>(null);
	let newTargetSets = $state(3);
	let newTargetReps = $state(10);
	let newTargetWeight = $state(0);
	let showPreview = $state(false);

	onMount(async () => {
		availableExercises = await db.exercises.toArray();
	});

	const filteredExercises = $derived.by(() => {
		if (!exerciseSearch) return availableExercises;
		return availableExercises.filter((ex) => ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()));
	});

	const isFormValid = $derived.by(() => {
		return !!workoutName.trim() && workoutExercises.length > 0;
	});

	function addExercise() {
		if (!selectedExercise) return;

		const exerciseRoutine: ExerciseRoutine = {
			exerciseId: selectedExercise.id,
			exerciseName: selectedExercise.name,
			targetSets: newTargetSets,
			targetReps: newTargetReps,
			targetWeight: newTargetWeight
		};

		workoutExercises = [...workoutExercises, exerciseRoutine];
		exerciseSearch = '';
		selectedExercise = null;
		newTargetSets = 3;
		newTargetReps = 10;
		newTargetWeight = 0;
	}

	function removeExercise(index: number) {
		workoutExercises = workoutExercises.filter((_, i) => i !== index);
	}

	function moveExerciseUp(index: number) {
		if (index === 0) return;
		const newExercises = [...workoutExercises];
		[newExercises[index - 1], newExercises[index]] = [newExercises[index], newExercises[index - 1]];
		workoutExercises = newExercises;
	}

	function moveExerciseDown(index: number) {
		if (index === workoutExercises.length - 1) return;
		const newExercises = [...workoutExercises];
		[newExercises[index], newExercises[index + 1]] = [newExercises[index + 1], newExercises[index]];
		workoutExercises = newExercises;
	}

	async function saveWorkout() {
		if (!isFormValid) return;

		const workout: Workout = {
			id: Date.now().toString(),
			name: workoutName.trim(),
			exercises: workoutExercises,
			notes: workoutNotes.trim() || undefined,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		await db.workouts.add(Dexie.deepClone(workout));
		await syncManager.addToSyncQueue('workout', workout.id, 'create', Dexie.deepClone(workout));
		onWorkoutCreated(workout);
		onClose();
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
		class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="p-6 border-b border-gray-200">
			<div class="flex items-center justify-between">
				<h2 id="modal-title" class="text-2xl font-bold text-gray-900">Create Workout Routine</h2>
				<button
					onclick={onClose}
					class="p-2 hover:bg-gray-100 rounded-full transition-colors"
					type="button"
				>
					<XIcon class="w-6 h-6 text-gray-500" />
				</button>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto p-6">
			<div class="space-y-6">
				<div>
					<label for="workout-name" class="block text-sm font-medium text-gray-700 mb-2">
						Workout Name *
					</label>
					<input
						id="workout-name"
						type="text"
						bind:value={workoutName}
						placeholder="e.g., Push Day A, Leg Day, Upper Body"
						autofocus
						class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
					/>
				</div>

				<div>
					<label for="exercise-search" class="block text-sm font-medium text-gray-700 mb-2">
						Add Exercises
					</label>
					<div class="relative mb-3">
						<SearchIcon class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
						<input
							id="exercise-search"
							type="text"
							bind:value={exerciseSearch}
							placeholder="Search exercises..."
							class="w-full pl-12 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
						/>
					</div>

					{#if filteredExercises.length > 0}
						<div class="border border-gray-200 rounded-lg max-h-48 overflow-y-auto mb-4">
							{#each filteredExercises as exercise (exercise.id)}
								<button
									onclick={() => (selectedExercise = exercise)}
									type="button"
									class="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
								>
									<span class="text-gray-900">{exercise.name}</span>
									<span class="ml-2 text-sm text-gray-500">({exercise.equipment})</span>
								</button>
							{/each}
						</div>
					{/if}

					{#if selectedExercise}
						<div class="bg-gray-50 rounded-lg p-4 mb-4">
							<h3 class="font-semibold text-gray-900 mb-3">Configure {selectedExercise.name}</h3>
							<div class="grid grid-cols-3 gap-4 mb-4">
								<div>
									<label for="target-sets" class="block text-sm font-medium text-gray-700 mb-2">
										Sets
									</label>
									<div class="flex gap-1">
										<button
											onclick={() => newTargetSets = Math.max(1, newTargetSets - 1)}
											type="button"
											class="px-3 py-3 bg-gray-200 text-gray-700 rounded-l-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-lg font-semibold"
											aria-label="Decrease sets"
										>
											-
										</button>
										<input
											id="target-sets"
											type="number"
											min="1"
											inputmode="numeric"
											bind:value={newTargetSets}
											class="flex-1 px-3 py-3 text-base text-center border-y border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
										/>
										<button
											onclick={() => newTargetSets += 1}
											type="button"
											class="px-3 py-3 bg-gray-200 text-gray-700 rounded-r-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-lg font-semibold"
											aria-label="Increase sets"
										>
											+
										</button>
									</div>
								</div>
								<div>
									<label for="target-reps" class="block text-sm font-medium text-gray-700 mb-2">
										Reps
									</label>
									<div class="flex gap-1">
										<button
											onclick={() => newTargetReps = Math.max(1, newTargetReps - 1)}
											type="button"
											class="px-3 py-3 bg-gray-200 text-gray-700 rounded-l-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-lg font-semibold"
											aria-label="Decrease reps"
										>
											-
										</button>
										<input
											id="target-reps"
											type="number"
											min="1"
											inputmode="numeric"
											bind:value={newTargetReps}
											class="flex-1 px-3 py-3 text-base text-center border-y border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
										/>
										<button
											onclick={() => newTargetReps += 1}
											type="button"
											class="px-3 py-3 bg-gray-200 text-gray-700 rounded-r-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-lg font-semibold"
											aria-label="Increase reps"
										>
											+
										</button>
									</div>
								</div>
								<div>
									<label for="target-weight" class="block text-sm font-medium text-gray-700 mb-2">
										Weight (lbs)
									</label>
									<div class="flex gap-1">
										<button
											onclick={() => newTargetWeight = Math.max(0, newTargetWeight - 5)}
											type="button"
											class="px-3 py-3 bg-gray-200 text-gray-700 rounded-l-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-lg font-semibold"
											aria-label="Decrease weight"
										>
											-
										</button>
										<input
											id="target-weight"
											type="number"
											min="0"
											inputmode="numeric"
											bind:value={newTargetWeight}
											class="flex-1 px-3 py-3 text-base text-center border-y border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
										/>
										<button
											onclick={() => newTargetWeight += 5}
											type="button"
											class="px-3 py-3 bg-gray-200 text-gray-700 rounded-r-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-lg font-semibold"
											aria-label="Increase weight"
										>
											+
										</button>
									</div>
								</div>
							</div>
							<button
								onclick={addExercise}
								type="button"
								class="w-full px-4 py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
							>
								Add Exercise
							</button>
						</div>
					{/if}
				</div>

				{#if workoutExercises.length > 0}
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Exercises ({workoutExercises.length})
						</label>
						<div class="border border-gray-200 rounded-lg divide-y divide-gray-100">
							{#each workoutExercises as exercise, index (exercise.exerciseId + index)}
								<div class="p-4 flex items-center gap-4">
									<div class="flex-shrink-0 flex flex-col gap-1">
										<button
											onclick={() => moveExerciseUp(index)}
											disabled={index === 0}
											type="button"
											class="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
										>
											<ChevronUpIcon class="w-4 h-4 text-gray-600" />
										</button>
										<button
											onclick={() => moveExerciseDown(index)}
											disabled={index === workoutExercises.length - 1}
											type="button"
											class="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
										>
											<ChevronDownIcon class="w-4 h-4 text-gray-600" />
										</button>
									</div>
									<div class="flex-1 min-w-0">
										<h4 class="font-medium text-gray-900 truncate">{exercise.exerciseName}</h4>
										<p class="text-sm text-gray-500">
											{exercise.targetSets} sets × {exercise.targetReps} reps
											{exercise.targetWeight > 0 ? ` @ ${exercise.targetWeight} lbs` : ''}
										</p>
									</div>
									<button
										onclick={() => removeExercise(index)}
										type="button"
										class="flex-shrink-0 p-2 hover:bg-red-50 rounded-full transition-colors text-red-500 hover:text-red-700"
									>
										<XIcon class="w-5 h-5" />
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div>
					<label for="workout-notes" class="block text-sm font-medium text-gray-700 mb-2">
						Notes (optional)
					</label>
					<textarea
						id="workout-notes"
						bind:value={workoutNotes}
						placeholder="Add any notes about this workout routine..."
						rows="3"
						class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
					></textarea>
				</div>
			</div>
		</div>

		<div class="p-6 border-t border-gray-200 bg-gray-50">
			<div class="flex flex-col sm:flex-row gap-3">
				<button
					onclick={() => (showPreview = true)}
					disabled={!isFormValid}
					type="button"
					class="flex-1 px-4 py-3 text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
				>
					Preview
				</button>
				<button
					onclick={onClose}
					type="button"
					class="flex-1 px-4 py-3 text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors min-h-[44px]"
				>
					Cancel
				</button>
				<button
					onclick={() => (showPreview ? saveWorkout() : (showPreview = true))}
					disabled={!isFormValid}
					type="button"
					class="flex-1 px-4 py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
				>
					{showPreview ? 'Save Workout' : 'Preview & Save'}
				</button>
			</div>
		</div>
	</div>
</div>

{#if showPreview}
	<div class="fixed inset-0 bg-black-50 bg-opacity-50 flex items-center justify-center p-4 z-[60]">
		<div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto p-6">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-900">Workout Preview</h2>
				<button
					onclick={() => (showPreview = false)}
					class="p-2 hover:bg-gray-100 rounded-full transition-colors"
					type="button"
				>
					<XIcon class="w-6 h-6 text-gray-500" />
				</button>
			</div>

			<div class="space-y-6">
				<div>
					<h3 class="text-xl font-bold text-gray-900">{workoutName}</h3>
					{#if workoutExercises.length > 0}
						<p class="text-gray-600">
							{workoutExercises.length} exercise{workoutExercises.length > 1 ? 's' : ''}
						</p>
					{/if}
				</div>

				{#if workoutExercises.length > 0}
					<div class="space-y-3">
						{#each workoutExercises as exercise, index (exercise.exerciseId + index)}
							<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
								<span
									class="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-800 rounded-full font-semibold text-sm"
								>
									{index + 1}
								</span>
								<div class="flex-1">
									<h4 class="font-medium text-gray-900">{exercise.exerciseName}</h4>
									<p class="text-sm text-gray-500">
										{exercise.targetSets} sets × {exercise.targetReps} reps
										{exercise.targetWeight > 0 ? ` @ ${exercise.targetWeight} lbs` : ''}
									</p>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if workoutNotes}
					<div>
						<h4 class="font-medium text-gray-900 mb-1">Notes</h4>
						<p class="text-gray-600">{workoutNotes}</p>
					</div>
				{/if}
			</div>

			<div class="flex gap-3 mt-6 pt-6 border-t border-gray-200">
				<button
					onclick={() => (showPreview = false)}
					type="button"
					class="flex-1 px-4 py-3 text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
				>
					Back to Edit
				</button>
				<button
					onclick={saveWorkout}
					type="button"
					class="flex-1 px-4 py-3 text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors min-h-[44px]"
				>
					Save Workout
				</button>
			</div>
		</div>
	</div>
{/if}
