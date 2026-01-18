<script lang="ts">
	import Dexie from 'dexie';
	import { onMount } from 'svelte';
	import { fade, scale, slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { db } from '$lib/db';
	import type { Exercise, ExerciseRoutine, Workout } from '$lib/types';
	import XIcon from '$lib/components/XIcon.svelte';
	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import ChevronUpIcon from '$lib/components/ChevronUpIcon.svelte';
	import ChevronDownIcon from '$lib/components/ChevronDownIcon.svelte';
	import NumberSpinner from '$lib/ui/NumberSpinner.svelte';

	let { onClose, onWorkoutUpdated, workout: initialWorkout } = $props<{
		onClose: () => void;
		onWorkoutUpdated: (workout: Workout) => void;
		workout?: Workout;
	}>();

	const isCreateMode = $derived(!initialWorkout || !initialWorkout.id);

	let availableExercises = $state<Exercise[]>([]);
	let workoutName = $state('');
	let workoutExercises = $state<ExerciseRoutine[]>([]);
	let workoutNotes = $state('');
	let exerciseSearch = $state('');
	let selectedExercise = $state<Exercise | null>(null);
	let newTargetSets = $state(3);
	let newTargetReps = $state(10);
	let newTargetWeight = $state(0);

	onMount(() => {
		if (initialWorkout) {
			workoutName = initialWorkout.name;
			workoutExercises = [...initialWorkout.exercises];
			workoutNotes = initialWorkout.notes || '';
		}
		loadExercises();
	});

	async function loadExercises() {
		availableExercises = await db.exercises.toArray();
	}

	const filteredExercises = $derived.by(() => {
		if (!exerciseSearch) return availableExercises;
		return availableExercises.filter((ex) => ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()));
	});

	const availableForSelection = $derived.by(() => {
		return filteredExercises.filter((ex) =>
			!workoutExercises.some((we) => we.exerciseId === ex.id)
		);
	});

	const isFormValid = $derived.by(() => {
		return !!workoutName.trim();
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

	function updateExercise(index: number) {
		return (property: 'targetSets' | 'targetReps' | 'targetWeight', value: number) => {
			const newExercises = [...workoutExercises];
			newExercises[index] = { ...newExercises[index], [property]: value };
			workoutExercises = newExercises;
		};
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

		if (isCreateMode) {
			const now = new Date().toISOString();
			const newWorkout: Workout = {
				id: Date.now().toString(),
				name: workoutName.trim(),
				exercises: workoutExercises,
				notes: workoutNotes.trim() || undefined,
				createdAt: now,
				updatedAt: now
			};

			await db.workouts.add(Dexie.deepClone(newWorkout));
			onWorkoutUpdated(newWorkout);
		} else if (initialWorkout) {
			const updates = {
				name: workoutName.trim(),
				exercises: workoutExercises,
				notes: workoutNotes.trim() || undefined,
				updatedAt: new Date().toISOString()
			};

			await db.workouts.update(initialWorkout.id, Dexie.deepClone(updates));
			const updatedWorkout: Workout = { ...initialWorkout, ...updates };
			onWorkoutUpdated(updatedWorkout);
		}
		onClose();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	transition:fade={{ duration: 150 }}
>
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
		class="bg-surface border border-border rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				onClose();
			}
		}}
		transition:scale={{ duration: 150, start: 0.95, easing: cubicOut }}
	>
		<div class="p-6 border-b border-border">
			<div class="flex items-center justify-between">
				<h2 id="modal-title" class="text-2xl font-display font-bold text-text-primary">{isCreateMode ? 'Create Workout' : 'Edit Workout Routine'}</h2>
				<button
					onclick={onClose}
					class="p-2 hover:bg-surface-elevated rounded-full transition-colors"
					type="button"
				>
					<XIcon class="w-6 h-6 text-text-muted" />
				</button>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto p-6">
			<div class="space-y-6">
				<div>
					<label for="workout-name" class="block text-sm font-medium text-text-secondary mb-2">
						Workout Name *
					</label>
					<!-- svelte-ignore a11y_autofocus -->
					<!-- User-initiated modal: autofocus on first field reduces tabbing -->
					<input
						id="workout-name"
						type="text"
						bind:value={workoutName}
						placeholder="e.g., Push Day A, Leg Day, Upper Body"
						autofocus
						class="w-full px-4 py-3 text-base bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary placeholder:text-text-muted min-h-[44px]"
					/>

				</div>

				<div>
					<h3 class="block text-sm font-medium text-text-secondary mb-2">
						Exercises ({workoutExercises.length})
					</h3>
					<div class="border border-border rounded-lg divide-y divide-border">
						{#each workoutExercises as exercise, index (exercise.exerciseId)}
							<div
								class="p-4 flex items-center gap-3"
								animate:flip={{ duration: 250 }}
								transition:slide={{ duration: 200 }}
							>
								<div class="flex-shrink-0 flex flex-col gap-1">
									<button
										onclick={() => moveExerciseUp(index)}
										disabled={index === 0}
										type="button"
										class="size-9 flex items-center justify-center bg-surface-elevated border border-border rounded-lg hover:bg-surface hover:border-text-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
									>
										<ChevronUpIcon class="w-5 h-5 text-text-secondary" />
									</button>
									<button
										onclick={() => moveExerciseDown(index)}
										disabled={index === workoutExercises.length - 1}
										type="button"
										class="size-9 flex items-center justify-center bg-surface-elevated border border-border rounded-lg hover:bg-surface hover:border-text-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
									>
										<ChevronDownIcon class="w-5 h-5 text-text-secondary" />
									</button>
								</div>
								<div class="flex-1 min-w-0">
									<h4 class="font-medium text-text-primary mb-2">{exercise.exerciseName}</h4>
									<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
										<NumberSpinner
											label="Sets"
											value={exercise.targetSets}
											min={1}
											step={1}
											size="sm"
											onchange={(v) => updateExercise(index)('targetSets', v)}
										/>
										<NumberSpinner
											label="Reps"
											value={exercise.targetReps}
											min={1}
											step={1}
											size="sm"
											onchange={(v) => updateExercise(index)('targetReps', v)}
										/>
										<NumberSpinner
											label="Weight (lbs)"
											value={exercise.targetWeight}
											min={0}
											step={5}
											size="sm"
											onchange={(v) => updateExercise(index)('targetWeight', v)}
										/>
									</div>
								</div>
								<button
									onclick={() => removeExercise(index)}
									type="button"
									class="flex-shrink-0 size-9 flex items-center justify-center bg-danger/10 border border-danger/20 rounded-full hover:bg-danger/20 hover:border-danger/40 transition-colors text-danger"
								>
									<XIcon class="w-5 h-5" />
								</button>
							</div>
						{/each}
					</div>
				</div>

				<div>
					<label for="exercise-search" class="block text-sm font-medium text-text-secondary mb-2">
						Add Exercise
					</label>
					<div class="relative mb-3">
						<SearchIcon class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
						<input
							id="exercise-search"
							type="text"
							bind:value={exerciseSearch}
							placeholder="Search exercises to add..."
							class="w-full pl-12 pr-4 py-3 text-base bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary placeholder:text-text-muted min-h-[44px]"
						/>
					</div>

					{#if availableForSelection.length > 0}
						<div
							class="border border-border rounded-lg max-h-48 overflow-y-auto mb-4"
							transition:slide={{ duration: 150 }}
						>
							{#each availableForSelection as exercise (exercise.id)}
								<button
									onclick={() => (selectedExercise = exercise)}
									type="button"
									class="w-full px-4 py-3 text-left hover:bg-surface-elevated border-b border-border last:border-b-0 transition-colors"
								>
									<span class="text-text-primary">{exercise.name}</span>
									<span class="ml-2 text-sm text-text-secondary">({exercise.equipment})</span>
								</button>
							{/each}
						</div>
					{:else if exerciseSearch}
						<p class="text-sm text-text-muted">No exercises found or all exercises already added.</p>
					{/if}

					{#if selectedExercise}
						<div
							class="bg-surface-elevated border border-border rounded-lg p-4 mb-4"
							transition:slide={{ duration: 200 }}
						>
							<h3 class="font-semibold text-text-primary mb-4">Configure {selectedExercise.name}</h3>
							<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
								<NumberSpinner
									label="Sets"
									bind:value={newTargetSets}
									min={1}
									step={1}
									size="sm"
								/>
								<NumberSpinner
									label="Reps"
									bind:value={newTargetReps}
									min={1}
									step={1}
									size="sm"
								/>
								<NumberSpinner
									label="Weight (lbs)"
									bind:value={newTargetWeight}
									min={0}
									step={5}
									size="sm"
								/>
							</div>
							<button
								onclick={addExercise}
								type="button"
								class="w-full px-4 py-3 text-base bg-accent text-bg rounded-lg hover:bg-accent-muted hover:shadow-[0_0_20px_rgba(197,255,0,0.3)] transition-all min-h-[44px] font-medium"
							>
								Add Exercise
							</button>
						</div>
					{/if}
				</div>

				<div>
					<label for="workout-notes" class="block text-sm font-medium text-text-secondary mb-2">
						Notes (optional)
					</label>
					<textarea
						id="workout-notes"
						bind:value={workoutNotes}
						placeholder="Add any notes about this workout routine..."
						rows="3"
						class="w-full px-4 py-3 text-base bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary placeholder:text-text-muted min-h-[44px]"
					></textarea>
				</div>
			</div>
		</div>

		<div class="p-6 border-t border-border bg-surface-elevated">
			<div class="flex gap-3">
				<button
					onclick={onClose}
					type="button"
					class="flex-1 px-4 py-3 text-base border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors min-h-[44px]"
				>
					Cancel
				</button>
				<button
					onclick={saveWorkout}
					disabled={!isFormValid}
					type="button"
					class="flex-1 px-4 py-3 text-base bg-accent text-bg rounded-lg hover:bg-accent-muted hover:shadow-[0_0_20px_rgba(197,255,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[44px] font-medium"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
</div>
