<script lang="ts">
	import { db, seedDefaultExercises } from '$lib/db';
	import type { Exercise, ExerciseCategory, MuscleGroup, PersonalRecord } from '$lib/types';
	import { getAllPersonalRecords, getRepRangeLabel } from '$lib/prUtils';
	import { Search, X, Plus } from 'lucide-svelte';
	import { Button, Card, SearchInput, Select, PageHeader } from '$lib/ui';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import { formatMuscle } from '$lib/formatUtils';

	const exercisesCol = db.collection('exercises');
	let exercises = $state<Exercise[]>([]);
	let allPRs = $state<PersonalRecord[]>([]);

	$effect(() => {
		exercisesCol.get().then((data) => {
			exercises = data as Exercise[];
		});
	});

	$effect(() => {
		getAllPersonalRecords().then((data) => {
			allPRs = data;
		});
	});

	let exercisePRs = $derived.by(() => {
		const map: Record<string, PersonalRecord[]> = {};
		for (const pr of allPRs) {
			if (!map[pr.exerciseId]) map[pr.exerciseId] = [];
			map[pr.exerciseId].push(pr);
		}
		for (const prs of Object.values(map)) {
			prs.sort((a, b) => a.reps - b.reps);
		}
		return map;
	});

	let searchQuery = $state('');
	let selectedCategory = $state<ExerciseCategory | ''>('');
	let selectedMuscle = $state<MuscleGroup | ''>('');

	const categories: ExerciseCategory[] = ['compound', 'isolation', 'cardio', 'mobility'];
	const muscles: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full-body'];

	const categoryOptions = [
		{ value: '', label: 'All Categories' },
		...categories.map((c) => ({ value: c, label: formatMuscle(c) }))
	];

	const muscleOptions = [
		{ value: '', label: 'All Muscle Groups' },
		...muscles.map((m) => ({ value: m, label: formatMuscle(m) }))
	];

	const filteredExercises = $derived.by(() => {
		return exercises.filter((exercise) => {
			const matchesSearch =
				searchQuery === '' ||
				exercise.name.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesCategory = !selectedCategory || exercise.category === selectedCategory;

			const matchesMuscle = !selectedMuscle || exercise.primary_muscle === selectedMuscle;

			return matchesSearch && matchesCategory && matchesMuscle;
		});
	});

	function clearFilters() {
		searchQuery = '';
		selectedCategory = '';
		selectedMuscle = '';
	}

	let seeding = $state(false);

	async function handleSeedExercises() {
		if (seeding) return;
		seeding = true;
		try {
			await seedDefaultExercises();
			exercises = await exercisesCol.get() as Exercise[];
		} finally {
			seeding = false;
		}
	}

</script>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-6xl mx-auto w-full">
		<PageHeader title="Browse Exercises">
			{#snippet actions()}
				<Button variant="secondary" href="/exercises/new">
					<Plus class="w-4 h-4 sm:w-5 sm:h-5" />
					<span class="hidden sm:inline">Add Exercise</span>
				</Button>
			{/snippet}
		</PageHeader>

		<!-- Filters -->
		<Card class="mb-6">
			{#snippet children()}
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<SearchInput
						label="Search"
						bind:value={searchQuery}
						placeholder="Search exercises..."
					/>

					<Select
						label="Category"
						bind:value={selectedCategory}
						options={categoryOptions}
					/>

					<Select
						label="Muscle Group"
						bind:value={selectedMuscle}
						options={muscleOptions}
					/>
				</div>

				{#if searchQuery || selectedCategory || selectedMuscle}
					<div class="mt-4 flex items-center justify-between">
						<p class="text-sm text-text-secondary">
							Showing {filteredExercises.length} of {exercises.length} exercises
						</p>
						<button
							onclick={clearFilters}
							class="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
						>
							<X class="w-4 h-4" />
							Clear Filters
						</button>
					</div>
				{/if}
			{/snippet}
		</Card>

		{#if filteredExercises.length === 0}
			<Card class="text-center" padding="lg">
				{#snippet children()}
					<div class="text-text-muted mb-4">
						<Search class="w-16 h-16 mx-auto opacity-50" />
					</div>
					<h2 class="text-xl font-semibold font-display text-text-primary mb-2">No exercises found</h2>
					<p class="text-text-secondary">
						{#if searchQuery || selectedCategory || selectedMuscle}
							Try adjusting your search or filters
						{:else}
							No exercises available yet
						{/if}
					</p>
					{#if exercises.length === 0}
						<Button onclick={handleSeedExercises} class="mt-4" disabled={seeding}>
							{seeding ? 'Loading...' : 'Load Default Exercises'}
						</Button>
					{/if}
				{/snippet}
			</Card>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each filteredExercises as exercise}
					<a href="/exercises/{exercise.id}" class="block">
						<Card hoverable>
							{#snippet children()}
								<div class="flex items-start justify-between mb-3">
								<h3 class="text-lg font-semibold text-text-primary">{exercise.name}</h3>
								{#if exercise.is_custom}
									<span class="px-2 py-1 text-xs font-medium bg-accent/20 text-accent rounded-full">
										Custom
									</span>
								{/if}
							</div>

							{#if exercisePRs[exercise.id]}
								<div class="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3">
									<div class="flex items-center gap-2 mb-2">
										<span class="text-xl">🏆</span>
										<span class="font-semibold text-sm text-warning">Personal Records</span>
									</div>
									<div class="flex flex-wrap gap-2">
										{#each exercisePRs[exercise.id]?.slice(0, 3) as pr}
											<span class="text-xs bg-warning/20 text-warning px-2 py-1 rounded-full font-medium">
												{getRepRangeLabel(pr.reps)}: {pr.weight} {preferencesStore.weightLabel}
											</span>
										{/each}
										{#if (exercisePRs[exercise.id]?.length || 0) > 3}
											<span class="text-xs bg-surface-elevated text-text-secondary px-2 py-1 rounded-full">
												+{(exercisePRs[exercise.id]?.length || 0) - 3} more
											</span>
										{/if}
									</div>
								</div>
							{/if}

							<div class="space-y-2">
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-text-muted">Category:</span>
									<span class="text-sm text-text-secondary capitalize">{exercise.category}</span>
								</div>

								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-text-muted">Primary:</span>
									<span class="text-sm text-text-secondary capitalize">{exercise.primary_muscle}</span>
								</div>

								{#if exercise.secondary_muscles.length > 0}
									<div class="flex flex-wrap items-center gap-2">
										<span class="text-sm font-medium text-text-muted">Secondary:</span>
										<div class="flex flex-wrap gap-1">
											{#each exercise.secondary_muscles as muscle}
												<span class="text-xs bg-surface-elevated text-text-secondary px-2 py-0.5 rounded">
													{muscle}
												</span>
											{/each}
										</div>
									</div>
								{/if}

								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-text-muted">Equipment:</span>
									<span class="text-sm text-text-secondary">{exercise.equipment}</span>
								</div>
							</div>
						{/snippet}
						</Card>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>

