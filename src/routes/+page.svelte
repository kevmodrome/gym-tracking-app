<script lang="ts">
	import { onMount } from 'svelte';
	import { db, initializeExercises } from '$lib/db';
	import type { Exercise, ExerciseCategory, MuscleGroup } from '$lib/types';
	import { getPersonalRecordsForExercise, getRepRangeLabel } from '$lib/prUtils';
	import type { PersonalRecord } from '$lib/types';
	import SearchIcon from '$lib/components/SearchIcon.svelte';
	import XIcon from '$lib/components/XIcon.svelte';
	import PlusIcon from '$lib/components/PlusIcon.svelte';
	import CreateExerciseModal from '$lib/components/CreateExerciseModal.svelte';
	import CreateWorkoutModal from '$lib/components/CreateWorkoutModal.svelte';
	import ImportBackupModal from '$lib/components/ImportBackupModal.svelte';
	import { exportBackupData } from '$lib/backupUtils';
	import { Button, Card, SearchInput, Select, Modal } from '$lib/ui';

	let exercises = $state<Exercise[]>([]);
	let exercisePRs = $state<Map<string, PersonalRecord[]>>(new Map());
	let searchQuery = $state('');
	let selectedCategory = $state<ExerciseCategory | ''>('');
	let selectedMuscle = $state<MuscleGroup | ''>('');
	let showCreateModal = $state(false);
	let showWorkoutModal = $state(false);
	let showImportModal = $state(false);
	let showExportModal = $state(false);
	let exportProgress = $state({ current: 0, total: 0, stage: '' });
	let exportResult = $state<{ success: boolean; message: string } | null>(null);

	const categories: ExerciseCategory[] = ['compound', 'isolation', 'cardio', 'mobility'];
	const muscles: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full-body'];

	const categoryOptions = [
		{ value: '', label: 'All Categories' },
		...categories.map(c => ({ value: c, label: formatMuscle(c) }))
	];

	const muscleOptions = [
		{ value: '', label: 'All Muscle Groups' },
		...muscles.map(m => ({ value: m, label: formatMuscle(m) }))
	];

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
		await loadPersonalRecords();
	});

	async function loadPersonalRecords() {
		const prMap = new Map<string, PersonalRecord[]>();
		for (const exercise of exercises) {
			const prs = await getPersonalRecordsForExercise(exercise.id);
			if (prs.length > 0) {
				prMap.set(exercise.id, prs);
			}
		}
		exercisePRs = prMap;
	}

	async function handleExerciseCreated(newExercise: Exercise) {
		exercises = await db.exercises.toArray();
	}

	function handleWorkoutCreated() {
		showWorkoutModal = false;
	}

	function clearFilters() {
		searchQuery = '';
		selectedCategory = '';
		selectedMuscle = '';
	}

	function formatMuscle(muscle: string): string {
		return muscle.charAt(0).toUpperCase() + muscle.slice(1);
	}

	async function handleExport() {
		showExportModal = true;
		exportResult = null;
		exportProgress = { current: 0, total: 0, stage: 'Starting...' };

		const result = await exportBackupData((current: number, total: number, stage: string) => {
			exportProgress = { current, total, stage };
		});

		exportResult = result;

		setTimeout(() => {
			showExportModal = false;
		}, 3000);
	}
</script>

<div class="min-h-screen bg-gray-100 p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-6xl mx-auto w-full">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
			<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Browse Exercises</h1>
			<div class="flex flex-wrap gap-2 sm:gap-3">
				<Button variant="secondary" href="/settings" class="bg-gray-700 hover:bg-gray-800">
					⚙️ <span class="hidden sm:inline">Settings</span>
				</Button>
				<Button variant="secondary" href="/history" class="bg-gray-600 hover:bg-gray-700">
					📜 <span class="hidden sm:inline">History</span>
				</Button>
				<Button variant="secondary" href="/progress" class="bg-indigo-600 hover:bg-indigo-700">
					📈 <span class="hidden sm:inline">Progress</span>
				</Button>
				<Button variant="secondary" href="/pr" class="bg-yellow-600 hover:bg-yellow-700">
					🏆 <span class="hidden sm:inline">PRs</span>
				</Button>
				<Button variant="secondary" href="/dashboard" class="bg-purple-600 hover:bg-purple-700">
					📊 <span class="hidden sm:inline">Dashboard</span>
				</Button>
				<Button variant="success" onclick={() => (showWorkoutModal = true)}>
					<PlusIcon class="w-4 h-4 sm:w-5 sm:h-5" />
					<span class="hidden sm:inline">Create Workout</span>
				</Button>
				<Button variant="success" href="/workout" class="bg-emerald-600 hover:bg-emerald-700">
					▶ <span class="hidden sm:inline">Start Workout</span>
				</Button>
				<Button variant="secondary" onclick={() => (showImportModal = true)} class="bg-orange-600 hover:bg-orange-700">
					📥 <span class="hidden sm:inline">Import</span>
				</Button>
				<Button variant="secondary" onclick={handleExport} class="bg-teal-600 hover:bg-teal-700">
					📤 <span class="hidden sm:inline">Export</span>
				</Button>
				<Button variant="primary" onclick={() => (showCreateModal = true)}>
					<PlusIcon class="w-4 h-4 sm:w-5 sm:h-5" />
					<span class="hidden sm:inline">Create Exercise</span>
				</Button>
			</div>
		</div>

		<Card class="mb-6">
			{#snippet children()}
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
			{/snippet}
		</Card>

		{#if filteredExercises.length === 0}
			<Card class="text-center" padding="lg">
				{#snippet children()}
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
				{/snippet}
			</Card>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each filteredExercises as exercise}
					<Card hover>
						{#snippet children()}
							<div class="flex items-start justify-between mb-3">
								<h3 class="text-lg font-semibold text-gray-900">{exercise.name}</h3>
								{#if exercise.is_custom}
									<span
										class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
										>Custom</span
									>
								{/if}
							</div>

							{#if exercisePRs.has(exercise.id)}
								<div class="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-3 mb-3">
									<div class="flex items-center gap-2 mb-2">
										<span class="text-xl">🏆</span>
										<span class="font-semibold text-sm text-gray-800">Personal Records</span>
									</div>
									<div class="flex flex-wrap gap-2">
										{#each exercisePRs.get(exercise.id)?.slice(0, 3) as pr}
											<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
												{getRepRangeLabel(pr.reps)}: {pr.weight} lbs
											</span>
										{/each}
										{#if (exercisePRs.get(exercise.id)?.length || 0) > 3}
											<span class="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
												+{(exercisePRs.get(exercise.id)?.length || 0) - 3} more
											</span>
										{/if}
									</div>
								</div>
							{/if}

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
						{/snippet}
					</Card>
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

{#if showImportModal}
	<ImportBackupModal onClose={() => (showImportModal = false)} />
{/if}

<Modal
	open={showExportModal}
	title="Exporting Workout Data"
	size="sm"
	onclose={() => showExportModal = false}
>
	{#snippet children()}
		{#if exportResult === null}
			<div class="space-y-4">
				<div class="flex items-center gap-2">
					<div class="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
						<div
							class="bg-blue-600 h-full transition-all duration-300"
							style:width={exportProgress.total > 0 ? `${(exportProgress.current / exportProgress.total) * 100}%` : '0%'}
						></div>
					</div>
					<span class="text-sm text-gray-600">
						{exportProgress.total > 0 ? `${Math.round((exportProgress.current / exportProgress.total) * 100)}%` : '0%'}
					</span>
				</div>
				<p class="text-sm text-gray-600">{exportProgress.stage}</p>
			</div>
		{:else if exportResult.success}
			<div class="space-y-3">
				<div class="flex items-center gap-2 text-green-600">
					<span class="text-2xl">✓</span>
					<p class="font-medium">Export Complete!</p>
				</div>
				<p class="text-sm text-gray-600">{exportResult.message}</p>
				<p class="text-sm text-gray-500">File has been downloaded to your default download location.</p>
			</div>
		{:else}
			<div class="space-y-3">
				<div class="flex items-center gap-2 text-red-600">
					<span class="text-2xl">✗</span>
					<p class="font-medium">Export Failed</p>
				</div>
				<p class="text-sm text-gray-600">{exportResult.message}</p>
			</div>
		{/if}
	{/snippet}
</Modal>
