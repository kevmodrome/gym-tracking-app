<script lang="ts">
	import Dexie from 'dexie';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { db } from '$lib/db';
	import type { Exercise, ExerciseRoutine, Workout } from '$lib/types';
	import XIcon from '$lib/components/XIcon.svelte';
	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import ChevronUpIcon from '$lib/components/ChevronUpIcon.svelte';
	import ChevronDownIcon from '$lib/components/ChevronDownIcon.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { Button, Card, Textarea } from '$lib/ui';
	import NumberSpinner from '$lib/ui/NumberSpinner.svelte';
	import { invalidateWorkouts } from '$lib/invalidation';

	// Form state
	let availableExercises = $state<Exercise[]>([]);
	let workoutName = $state('');
	let workoutExercises = $state<ExerciseRoutine[]>([]);
	let workoutNotes = $state('');

	// UI state
	let exerciseSearch = $state('');
	let selectedExercise = $state<Exercise | null>(null);
	let newTargetSets = $state(3);
	let newTargetReps = $state(10);
	let newTargetWeight = $state(0);
	let saving = $state(false);

	onMount(() => {
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

	async function createWorkout() {
		if (!isFormValid) return;

		saving = true;
		try {
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
			await invalidateWorkouts();
			toastStore.showSuccess('Workout created successfully');
			goto('/workout');
		} catch (error) {
			console.error('Failed to create workout:', error);
			toastStore.showError('Failed to create workout');
		} finally {
			saving = false;
		}
	}

	function cancelCreate() {
		goto('/workout');
	}
</script>

<svelte:head>
	<title>Create Workout - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-bg flex flex-col">
	<div class="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 pb-44 md:pb-8">
		<div class="max-w-4xl mx-auto w-full">
			<!-- Header -->
			<div class="flex items-center justify-between mb-4 sm:mb-6">
				<Button variant="ghost" href="/workout">← Back</Button>
				<h1 class="text-xl sm:text-2xl font-bold font-display text-text-primary">Create Workout</h1>
				<div class="w-20"></div>
			</div>

			<Card class="mb-4">
				{#snippet children()}
					<div class="space-y-6">
						<!-- Workout Name -->
						<div>
							<label for="workout-name" class="block text-sm font-medium text-text-secondary mb-2">
								Workout Name *
							</label>
							<!-- svelte-ignore a11y_autofocus -->
							<input
								id="workout-name"
								type="text"
								bind:value={workoutName}
								placeholder="e.g., Push Day A, Leg Day, Upper Body"
								autofocus
								class="w-full px-4 py-3 text-base bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary placeholder:text-text-muted min-h-[44px]"
							/>
						</div>

						<!-- Exercises List -->
						<div>
							<h3 class="block text-sm font-medium text-text-secondary mb-2">
								Exercises ({workoutExercises.length})
							</h3>
							{#if workoutExercises.length > 0}
								<div class="border border-border rounded-lg divide-y divide-border mb-4">
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
												<div class="flex items-center justify-between mb-2">
													<h4 class="font-medium text-text-primary">{exercise.exerciseName}</h4>
													<button
														onclick={() => removeExercise(index)}
														type="button"
														class="flex-shrink-0 size-8 flex items-center justify-center bg-danger/10 border border-danger/20 rounded-full hover:bg-danger/20 hover:border-danger/40 transition-colors text-danger"
													>
														<XIcon class="w-4 h-4" />
													</button>
												</div>
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
										</div>
									{/each}
								</div>
							{:else}
								<div class="border border-border rounded-lg p-4 mb-4 text-center text-text-muted">
									No exercises added yet
								</div>
							{/if}
						</div>

						<!-- Add Exercise -->
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
								<p class="text-sm text-text-muted mb-4">No exercises found or all exercises already added.</p>
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

						<!-- Notes -->
						<div>
							<Textarea
								label="Notes (optional)"
								bind:value={workoutNotes}
								placeholder="Add any notes about this workout routine..."
								rows={3}
							/>
						</div>
					</div>
				{/snippet}
			</Card>

			<!-- Desktop Action Buttons (inline) -->
			<div class="hidden md:flex flex-row gap-3">
				<Button variant="ghost" onclick={cancelCreate} class="flex-1">
					Cancel
				</Button>
				<Button
					variant="primary"
					onclick={createWorkout}
					disabled={!isFormValid || saving}
					class="flex-1"
				>
					{saving ? 'Creating...' : 'Create Workout'}
				</Button>
			</div>
		</div>
	</div>

	<!-- Fixed Bottom Action Bar - Mobile -->
	<div class="fixed bottom-20 left-0 right-0 bg-surface border-t border-border p-4 md:hidden z-40">
		<div class="max-w-4xl mx-auto space-y-3">
			<Button
				variant="primary"
				fullWidth
				size="lg"
				onclick={createWorkout}
				disabled={!isFormValid || saving}
			>
				{saving ? 'Creating...' : 'Create Workout'}
			</Button>
			<Button variant="ghost" fullWidth onclick={cancelCreate}>
				Cancel
			</Button>
		</div>
	</div>
</div>
