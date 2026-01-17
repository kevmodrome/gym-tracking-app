<script lang="ts">
	import { onMount } from 'svelte';
	import { db, initializeExercises } from '$lib/db';
	import type { Exercise, ExerciseCategory, MuscleGroup } from '$lib/types';
	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import XIcon from '$lib/components/XIcon.svelte';
	import PlusIcon from '$lib/components/PlusIcon.svelte';
	import CreateExerciseModal from '$lib/components/CreateExerciseModal.svelte';
	import CreateWorkoutModal from '$lib/components/CreateWorkoutModal.svelte';

	let exercises = $state<Exercise[]>([]);
	let searchQuery = $state('');
	let selectedCategory = $state<ExerciseCategory | undefined>(undefined);
	let selectedMuscle = $state<MuscleGroup | undefined>(undefined);
	let showCreateModal = $state(false);
	let showWorkoutModal = $state(false);

	const categories: ExerciseCategory[] = ['compound', 'isolation', 'cardio', 'mobility'];
	const muscles: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full-body'];

	const filteredExercises = $derived.by(() => {
		return exercises.filter((exercise) => {
			const matchesSearch =
				searchQuery === '' ||
				exercise.name.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesCategory =
				!selectedCategory || exercise.category === selectedCategory;

			const matchesMuscle =
				!selectedMuscle || exercise.primary_muscle === selectedMuscle;

			return matchesSearch && matchesCategory && matchesMuscle;
		});
	});

	onMount(async () => {
		await initializeExercises();
		exercises = await db.exercises.toArray();
	});

	async function handleExerciseCreated(newExercise: Exercise) {
		exercises = await db.exercises.toArray();
	}

	function handleWorkoutCreated() {
		showWorkoutModal = false;
	}

	function clearFilters() {
		searchQuery = '';
		selectedCategory = undefined;
		selectedMuscle = undefined;
	}

	function formatMuscle(muscle: string): string {
		return muscle.charAt(0).toUpperCase() + muscle.slice(1);
	}
</script>

<div class="min-h-screen bg-gray-100 p-4 md:p-8">
	<div class="max-w-6xl mx-auto">
		<div class="flex items-center justify-between mb-6">
			<h1 class="text-3xl font-bold text-gray-900">Browse Exercises</h1>
			<div class="flex gap-3">
				<button
					onclick={() => (showWorkoutModal = true)}
					class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
					type="button"
				>
					<PlusIcon class="w-5 h-5" />
					Create Workout
				</button>
				<button
					onclick={() => (showCreateModal = true)}
					class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					type="button"
				>
					<PlusIcon class="w-5 h-5" />
					Create Exercise
				</button>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div class="relative">
					<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search exercises..."
						class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>

				<div>
					<label for="category-filter" class="block text-sm font-medium text-gray-700 mb-1">
						Category
					</label>
					<select
						id="category-filter"
						bind:value={selectedCategory}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						<option value="">All Categories</option>
						{#each categories as category}
							<option value={category}>{formatMuscle(category)}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="muscle-filter" class="block text-sm font-medium text-gray-700 mb-1">
						Muscle Group
					</label>
					<select
						id="muscle-filter"
						bind:value={selectedMuscle}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						<option value="">All Muscle Groups</option>
						{#each muscles as muscle}
							<option value={muscle}>{formatMuscle(muscle)}</option>
						{/each}
					</select>
				</div>
			</div>

			{#if searchQuery || selectedCategory || selectedMuscle}
				<div class="mt-4 flex items-center justify-between">
					<p class="text-sm text-gray-600">
						Showing {filteredExercises.length} of {exercises.length} exercises
					</p>
					<button
						onclick={clearFilters}
						class="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
					>
						<XIcon class="w-4 h-4" />
						Clear Filters
					</button>
				</div>
			{/if}
		</div>

		{#if filteredExercises.length === 0}
			<div class="bg-white rounded-lg shadow-md p-12 text-center">
				<div class="text-gray-400 mb-4">
					<SearchIcon class="w-16 h-16 mx-auto" />
				</div>
				<h2 class="text-xl font-semibold text-gray-900 mb-2">No exercises found</h2>
				<p class="text-gray-600">
					{#if searchQuery || selectedCategory || selectedMuscle}
						Try adjusting your search or filters
					{:else}
						No exercises available yet
					{/if}
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each filteredExercises as exercise}
					<div class="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow">
						<div class="flex items-start justify-between mb-3">
							<h3 class="text-lg font-semibold text-gray-900">{exercise.name}</h3>
							{#if exercise.is_custom}
								<span
									class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
									>Custom</span
								>
							{/if}
						</div>

						<div class="space-y-2">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-gray-500">Category:</span>
								<span class="text-sm text-gray-700 capitalize">{exercise.category}</span>
							</div>

							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-gray-500">Primary:</span>
								<span class="text-sm text-gray-700 capitalize">{exercise.primary_muscle}</span>
							</div>

							{#if exercise.secondary_muscles.length > 0}
								<div class="flex flex-wrap items-center gap-2">
									<span class="text-sm font-medium text-gray-500">Secondary:</span>
									<div class="flex flex-wrap gap-1">
										{#each exercise.secondary_muscles as muscle}
											<span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
												{muscle}
											</span>
										{/each}
									</div>
								</div>
							{/if}

							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-gray-500">Equipment:</span>
								<span class="text-sm text-gray-700">{exercise.equipment}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if showCreateModal}
	<CreateExerciseModal
		onCreate={handleExerciseCreated}
		onClose={() => (showCreateModal = false)}
	/>
{/if}

{#if showWorkoutModal}
	<CreateWorkoutModal
		onWorkoutCreated={handleWorkoutCreated}
		onClose={() => (showWorkoutModal = false)}
	/>
{/if}
