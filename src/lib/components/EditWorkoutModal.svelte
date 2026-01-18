<script lang="ts">
	import Dexie from 'dexie';
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import type { Exercise, ExerciseRoutine, Workout } from '$lib/types';
	import XIcon from '$lib/components/XIcon.svelte';
	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import ChevronUpIcon from '$lib/components/ChevronUpIcon.svelte';
	import ChevronDownIcon from '$lib/components/ChevronDownIcon.svelte';

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

<div
	class="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
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
						{#each workoutExercises as exercise, index (exercise.exerciseId + index)}
							<div class="p-4 flex items-center gap-4">
								<div class="flex-shrink-0 flex flex-col gap-1">
									<button
										onclick={() => moveExerciseUp(index)}
										disabled={index === 0}
										type="button"
										class="p-1 hover:bg-surface-elevated rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
									>
										<ChevronUpIcon class="w-4 h-4 text-text-secondary" />
									</button>
									<button
										onclick={() => moveExerciseUp(index)}
										disabled={index === 0}
										type="button"
										class="p-1 hover:bg-surface-elevated rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
									>
										<ChevronUpIcon class="w-4 h-4 text-text-secondary" />
									</button>
									<button
										onclick={() => moveExerciseDown(index)}
										disabled={index === workoutExercises.length - 1}
										type="button"
										class="p-1 hover:bg-surface-elevated rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
									>
										<ChevronDownIcon class="w-4 h-4 text-text-secondary" />
									</button>
								</div>
								<div class="flex-1 min-w-0">
								</div>
								<div class="flex-1 min-w-0">
									<h4 class="font-medium text-text-primary mb-2">{exercise.exerciseName}</h4>
									<div class="grid grid-cols-3 gap-2">
										<div>
											<label for="exercise-sets-{index}" class="block text-xs font-medium text-text-muted mb-1">Sets</label>
											<input
												id="exercise-sets-{index}"
												type="number"
												min="1"
												inputmode="numeric"
												value={exercise.targetSets}
												oninput={(e) => updateExercise(index)('targetSets', parseInt((e.target as HTMLInputElement).value) || 1)}
												class="w-full px-2 py-2 text-base text-center bg-surface-elevated border border-border rounded focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary min-h-[36px]"
											/>
										</div>
										<div>
											<label for="exercise-reps-{index}" class="block text-xs font-medium text-text-muted mb-1">Reps</label>
											<input
												id="exercise-reps-{index}"
												type="number"
												min="1"
												inputmode="numeric"
												value={exercise.targetReps}
												oninput={(e) => updateExercise(index)('targetReps', parseInt((e.target as HTMLInputElement).value) || 1)}
												class="w-full px-2 py-2 text-base text-center bg-surface-elevated border border-border rounded focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary min-h-[36px]"
											/>
										</div>
										<div>
											<label for="exercise-weight-{index}" class="block text-xs font-medium text-text-muted mb-1">Weight</label>
											<input
												id="exercise-weight-{index}"
												type="number"
												min="0"
												inputmode="numeric"
												value={exercise.targetWeight}
												oninput={(e) => updateExercise(index)('targetWeight', parseInt((e.target as HTMLInputElement).value) || 0)}
												class="w-full px-2 py-2 text-base text-center bg-surface-elevated border border-border rounded focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary min-h-[36px]"
											/>
										</div>
									</div>
								</div>
								<button
									onclick={() => removeExercise(index)}
									type="button"
									class="flex-shrink-0 p-2 hover:bg-danger/10 rounded-full transition-colors text-danger hover:text-danger"
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
						<div class="border border-border rounded-lg max-h-48 overflow-y-auto mb-4">
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
						<div class="bg-surface-elevated border border-border rounded-lg p-4 mb-4">
							<h3 class="font-semibold text-text-primary mb-3">Configure {selectedExercise.name}</h3>
							<div class="grid grid-cols-3 gap-4 mb-4">
								<div>
									<label for="target-sets" class="block text-sm font-medium text-text-secondary mb-2">
										Sets
									</label>
									<div class="flex gap-1">
										<button
											onclick={() => newTargetSets = Math.max(1, newTargetSets - 1)}
											type="button"
											class="px-3 py-3 bg-surface border border-border text-text-secondary rounded-l-lg hover:bg-surface-elevated hover:text-text-primary min-w-[44px] min-h-[44px] text-lg font-semibold"
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
											class="flex-1 px-3 py-3 text-base text-center bg-surface border-y border-border focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary min-h-[44px]"
										/>
										<button
											onclick={() => newTargetSets += 1}
											type="button"
											class="px-3 py-3 bg-surface border border-border text-text-secondary rounded-r-lg hover:bg-surface-elevated hover:text-text-primary min-w-[44px] min-h-[44px] text-lg font-semibold"
											aria-label="Increase sets"
										>
											+
										</button>
									</div>
								</div>
								<div>
									<label for="target-reps" class="block text-sm font-medium text-text-secondary mb-2">
										Reps
									</label>
									<div class="flex gap-1">
										<button
											onclick={() => newTargetReps = Math.max(1, newTargetReps - 1)}
											type="button"
											class="px-3 py-3 bg-surface border border-border text-text-secondary rounded-l-lg hover:bg-surface-elevated hover:text-text-primary min-w-[44px] min-h-[44px] text-lg font-semibold"
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
											class="flex-1 px-3 py-3 text-base text-center bg-surface border-y border-border focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary min-h-[44px]"
										/>
										<button
											onclick={() => newTargetReps += 1}
											type="button"
											class="px-3 py-3 bg-surface border border-border text-text-secondary rounded-r-lg hover:bg-surface-elevated hover:text-text-primary min-w-[44px] min-h-[44px] text-lg font-semibold"
											aria-label="Increase reps"
										>
											+
										</button>
									</div>
								</div>
								<div>
									<label for="target-weight" class="block text-sm font-medium text-text-secondary mb-2">
										Weight (lbs)
									</label>
									<div class="flex gap-1">
										<button
											onclick={() => newTargetWeight = Math.max(0, newTargetWeight - 5)}
											type="button"
											class="px-3 py-3 bg-surface border border-border text-text-secondary rounded-l-lg hover:bg-surface-elevated hover:text-text-primary min-w-[44px] min-h-[44px] text-lg font-semibold"
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
											class="flex-1 px-3 py-3 text-base text-center bg-surface border-y border-border focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary min-h-[44px]"
										/>
										<button
											onclick={() => newTargetWeight += 5}
											type="button"
											class="px-3 py-3 bg-surface border border-border text-text-secondary rounded-r-lg hover:bg-surface-elevated hover:text-text-primary min-w-[44px] min-h-[44px] text-lg font-semibold"
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
