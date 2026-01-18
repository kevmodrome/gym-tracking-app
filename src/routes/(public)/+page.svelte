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

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-6xl mx-auto w-full">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
			<h1 class="text-2xl sm:text-3xl font-bold font-display text-text-primary">
				Browse Exercises
			</h1>
			<div class="flex flex-wrap gap-2 sm:gap-3">
				<Button variant="success" onclick={() => (showWorkoutModal = true)}>
					<PlusIcon class="w-4 h-4 sm:w-5 sm:h-5" />
					<span class="hidden sm:inline">Create Workout</span>
				</Button>
				<Button variant="primary" href="/workout">
					▶ <span class="hidden sm:inline">Start Workout</span>
				</Button>
				<Button variant="secondary" onclick={() => (showCreateModal = true)}>
					<PlusIcon class="w-4 h-4 sm:w-5 sm:h-5" />
					<span class="hidden sm:inline">Add Exercise</span>
				</Button>
			</div>
		</div>

		<!-- Quick Actions -->
		<div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
			<a href="/dashboard" class="bg-surface border border-border rounded-xl p-4 hover:border-border-active hover:bg-surface-elevated transition-all duration-200 group">
				<div class="text-2xl mb-2">📊</div>
				<div class="font-semibold text-text-primary group-hover:text-accent transition-colors">Dashboard</div>
				<div class="text-xs text-text-muted">View analytics</div>
			</a>
			<a href="/pr" class="bg-surface border border-border rounded-xl p-4 hover:border-warning/50 hover:bg-warning/5 transition-all duration-200 group">
				<div class="text-2xl mb-2">🏆</div>
				<div class="font-semibold text-text-primary group-hover:text-warning transition-colors">PRs</div>
				<div class="text-xs text-text-muted">Personal records</div>
			</a>
			<a href="/history" class="bg-surface border border-border rounded-xl p-4 hover:border-secondary/50 hover:bg-secondary/5 transition-all duration-200 group">
				<div class="text-2xl mb-2">📜</div>
				<div class="font-semibold text-text-primary group-hover:text-secondary transition-colors">History</div>
				<div class="text-xs text-text-muted">Past workouts</div>
			</a>
			<a href="/progress" class="bg-surface border border-border rounded-xl p-4 hover:border-accent/50 hover:bg-accent/5 transition-all duration-200 group">
				<div class="text-2xl mb-2">📈</div>
				<div class="font-semibold text-text-primary group-hover:text-accent transition-colors">Progress</div>
				<div class="text-xs text-text-muted">Track gains</div>
			</a>
			<a href="/settings" class="bg-surface border border-border rounded-xl p-4 hover:border-border-active hover:bg-surface-elevated transition-all duration-200 group">
				<div class="text-2xl mb-2">⚙️</div>
				<div class="font-semibold text-text-primary group-hover:text-text-secondary transition-colors">Settings</div>
				<div class="text-xs text-text-muted">Preferences</div>
			</a>
		</div>

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
							<XIcon class="w-4 h-4" />
							Clear Filters
						</button>
					</div>
				{/if}
			{/snippet}
		</Card>

		<!-- Data Management -->
		<div class="flex justify-end gap-2 mb-6">
			<Button variant="ghost" onclick={() => (showImportModal = true)} size="sm">
				📥 Import
			</Button>
			<Button variant="ghost" onclick={handleExport} size="sm">
				📤 Export
			</Button>
		</div>

		{#if filteredExercises.length === 0}
			<Card class="text-center" padding="lg">
				{#snippet children()}
					<div class="text-text-muted mb-4">
						<SearchIcon class="w-16 h-16 mx-auto opacity-50" />
					</div>
					<h2 class="text-xl font-semibold font-display text-text-primary mb-2">No exercises found</h2>
					<p class="text-text-secondary">
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

							{#if exercisePRs.has(exercise.id)}
								<div class="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3">
									<div class="flex items-center gap-2 mb-2">
										<span class="text-xl">🏆</span>
										<span class="font-semibold text-sm text-warning">Personal Records</span>
									</div>
									<div class="flex flex-wrap gap-2">
										{#each exercisePRs.get(exercise.id)?.slice(0, 3) as pr}
											<span class="text-xs bg-warning/20 text-warning px-2 py-1 rounded-full font-medium">
												{getRepRangeLabel(pr.reps)}: {pr.weight} lbs
											</span>
										{/each}
										{#if (exercisePRs.get(exercise.id)?.length || 0) > 3}
											<span class="text-xs bg-surface-elevated text-text-secondary px-2 py-1 rounded-full">
												+{(exercisePRs.get(exercise.id)?.length || 0) - 3} more
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
					<div class="flex-1 bg-surface-elevated rounded-full h-2 overflow-hidden">
						<div
							class="bg-accent h-full transition-all duration-300"
							style:width={exportProgress.total > 0 ? `${(exportProgress.current / exportProgress.total) * 100}%` : '0%'}
						></div>
					</div>
					<span class="text-sm text-text-secondary">
						{exportProgress.total > 0 ? `${Math.round((exportProgress.current / exportProgress.total) * 100)}%` : '0%'}
					</span>
				</div>
				<p class="text-sm text-text-secondary">{exportProgress.stage}</p>
			</div>
		{:else if exportResult.success}
			<div class="space-y-3">
				<div class="flex items-center gap-2 text-success">
					<span class="text-2xl">✓</span>
					<p class="font-medium">Export Complete!</p>
				</div>
				<p class="text-sm text-text-secondary">{exportResult.message}</p>
				<p class="text-sm text-text-muted">File has been downloaded to your default download location.</p>
			</div>
		{:else}
			<div class="space-y-3">
				<div class="flex items-center gap-2 text-danger">
					<span class="text-2xl">✗</span>
					<p class="font-medium">Export Failed</p>
				</div>
				<p class="text-sm text-text-secondary">{exportResult.message}</p>
			</div>
		{/if}
	{/snippet}
</Modal>
