<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { db } from '$lib/db';
	import type { Workout, Exercise, ExerciseRoutine } from '$lib/types';
	import {
		Button,
		Card,
		ConfirmDialog,
		Modal,
		NumberSpinner,
		PageHeader,
		TextInput,
		Textarea,
		EmptyState
	} from '$lib/ui';
	import ExercisePicker from '$lib/components/ExercisePicker.svelte';
	import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Timer, X } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toast.svelte';

	const workoutsCol = db.collection('workouts');
	const exercisesCol = db.collection('exercises');

	const routineId = $derived($page.params.id);

	let routine = $state<Workout | null>(null);
	let exercises = $state<Exercise[]>([]);
	let loading = $state(true);
	let notFound = $state(false);

	// Edit buffer
	let name = $state('');
	let exerciseList = $state<ExerciseRoutine[]>([]);
	let routineNotes = $state('');

	let saving = $state(false);
	let confirmDeleteOpen = $state(false);

	// Picker
	let pickerOpen = $state(false);

	$effect(() => {
		exercisesCol.get().then((data) => {
			exercises = data as Exercise[];
		});
	});

	$effect(() => {
		const id = routineId;
		if (!id) return;
		(async () => {
			loading = true;
			notFound = false;
			try {
				const r = (await workoutsCol.get(id)) as Workout;
				routine = r;
				name = r.name;
				exerciseList = (r.exercises ?? []).map((e) => ({
					...e,
					notes: e.notes ?? ''
				}));
				routineNotes = r.notes ?? '';
			} catch (e) {
				console.error('Failed to load routine:', e);
				notFound = true;
			}
			loading = false;
		})();
	});

	function openPicker() {
		pickerOpen = true;
	}

	function closePicker() {
		pickerOpen = false;
	}

	function addExerciseToRoutine(ex: Exercise) {
		exerciseList = [
			...exerciseList,
			{
				exerciseId: ex.id,
				exerciseName: ex.name,
				targetSets: 3,
				targetReps: 10,
				targetWeight: 0,
				notes: ''
			}
		];
		toastStore.showSuccess(`Added ${ex.name}`);
	}

	function removeExercise(index: number) {
		exerciseList = exerciseList.filter((_, i) => i !== index);
	}

	function moveExercise(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= exerciseList.length) return;
		const next = [...exerciseList];
		[next[index], next[target]] = [next[target], next[index]];
		exerciseList = next;
	}

	async function save() {
		if (!routine) return;
		if (saving) return;
		saving = true;
		try {
			const trimmedName = name.trim() || 'Untitled routine';
			await workoutsCol.update(routine.id, {
				name: trimmedName,
				exercises: exerciseList.map((e) => ({
					exerciseId: e.exerciseId,
					exerciseName: e.exerciseName,
					targetSets: e.targetSets,
					targetReps: e.targetReps,
					targetWeight: e.targetWeight,
					notes: e.notes && e.notes.trim() ? e.notes.trim() : undefined
				})),
				notes: routineNotes.trim() ? routineNotes.trim() : undefined,
				updatedAt: new Date().toISOString()
			});
			toastStore.showSuccess('Routine saved');
			await goto('/train');
		} catch (e) {
			console.error(e);
			toastStore.showError('Failed to save routine');
		} finally {
			saving = false;
		}
	}

	function askDelete() {
		confirmDeleteOpen = true;
	}

	async function confirmDelete() {
		if (!routine) return;
		confirmDeleteOpen = false;
		await workoutsCol.delete(routine.id);
		toastStore.showSuccess('Routine deleted');
		await goto('/train');
	}

	async function toggleFavorite(ex: Exercise) {
		const newValue = !ex.favorited;
		await exercisesCol.update(ex.id, { favorited: newValue });
		exercises = exercises.map((e) => (e.id === ex.id ? { ...e, favorited: newValue } : e));
	}
</script>

<div class="container mx-auto max-w-3xl px-4 pb-12">
	<PageHeader title={routine?.name || 'Routine'}>
		{#snippet actions()}
			<Button variant="ghost" size="sm" href="/train">
				<ArrowLeft class="w-4 h-4" />
				Back
			</Button>
		{/snippet}
	</PageHeader>

	{#if loading}
		<Card>
			{#snippet children()}
				<p class="text-text-muted text-sm">Loading...</p>
			{/snippet}
		</Card>
	{:else if notFound}
		<Card>
			{#snippet children()}
				<EmptyState
					title="Routine not found"
					description="This routine may have been deleted."
					actionLabel="Back to Train"
					actionHref="/train"
				/>
			{/snippet}
		</Card>
	{:else}
		<div class="space-y-6">
			<!-- Name -->
			<Card>
				{#snippet children()}
					<TextInput
						bind:value={name}
						label="Routine name"
						placeholder="e.g. Push Day"
					/>
				{/snippet}
			</Card>

			<!-- Exercises -->
			<section>
				<div class="flex items-center justify-between mb-3">
					<h2 class="font-display font-bold text-lg text-text-primary">Exercises</h2>
					<Button variant="secondary" size="sm" onclick={openPicker}>
						<Plus class="w-4 h-4" />
						Add exercise
					</Button>
				</div>

				{#if exerciseList.length === 0}
					<Card padding="none">
						{#snippet children()}
							<EmptyState
								title="No exercises yet"
								description="Add an exercise to start building this routine."
								actionLabel="+ Add exercise"
								onAction={openPicker}
							/>
						{/snippet}
					</Card>
				{:else}
					<div class="space-y-3">
						{#each exerciseList as ex, i (i + ':' + ex.exerciseId)}
							<Card padding="md">
								{#snippet children()}
									{@const lib = exercises.find((e) => e.id === ex.exerciseId)}
									<div class="flex items-start justify-between gap-3 mb-3">
										<div class="min-w-0">
											<h3 class="font-display font-semibold text-text-primary truncate">
												{ex.exerciseName}
											</h3>
											<div class="flex items-center gap-2 mt-0.5">
												<p class="text-xs text-text-muted">Position {i + 1}</p>
												{#if lib?.restSeconds && lib.restSeconds > 0}
													<span
														class="inline-flex items-center gap-1 text-xs text-text-secondary"
														title="Default rest for this exercise"
													>
														<Timer class="w-3 h-3" />
														<span class="tabular-nums">{lib.restSeconds}s</span>
													</span>
												{/if}
											</div>
										</div>
										<div class="flex items-center gap-1 flex-shrink-0">
											<Button
												variant="ghost"
												size="icon"
												onclick={() => moveExercise(i, -1)}
												disabled={i === 0}
												class="!min-w-[36px] !min-h-[36px] !p-1"
											>
												<ArrowUp class="w-4 h-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onclick={() => moveExercise(i, 1)}
												disabled={i === exerciseList.length - 1}
												class="!min-w-[36px] !min-h-[36px] !p-1"
											>
												<ArrowDown class="w-4 h-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onclick={() => removeExercise(i)}
												class="!min-w-[36px] !min-h-[36px] !p-1 text-danger hover:text-danger"
											>
												<Trash2 class="w-4 h-4" />
											</Button>
										</div>
									</div>
									<div class="grid grid-cols-3 gap-2">
										<NumberSpinner
											bind:value={exerciseList[i].targetSets}
											min={1}
											max={20}
											label="Sets"
											size="sm"
										/>
										<NumberSpinner
											bind:value={exerciseList[i].targetReps}
											min={0}
											max={100}
											label="Reps"
											size="sm"
										/>
										<NumberSpinner
											bind:value={exerciseList[i].targetWeight}
											min={0}
											step={2.5}
											label="Weight"
											size="sm"
										/>
									</div>
									<div class="mt-3">
										<TextInput
											bind:value={exerciseList[i].notes as string}
											label="Notes (optional)"
											placeholder="e.g. drop set on last"
										/>
									</div>
								{/snippet}
							</Card>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Routine notes -->
			<Card>
				{#snippet children()}
					<Textarea
						bind:value={routineNotes}
						label="Routine notes (optional)"
						placeholder="Anything to remember when running this routine"
						rows={2}
					/>
				{/snippet}
			</Card>

			<!-- Actions -->
			<div class="flex flex-col sm:flex-row gap-3 pt-2">
				<Button variant="primary" onclick={save} loading={saving} class="flex-1">
					Save routine
				</Button>
				<Button variant="danger" onclick={askDelete}>
					<Trash2 class="w-4 h-4" />
					Delete
				</Button>
			</div>
		</div>
	{/if}
</div>

<!-- Exercise picker modal -->
<Modal
	open={pickerOpen}
	title="Add exercise"
	size="md"
	fullScreenMobile
	onclose={closePicker}
>
	{#snippet children()}
		<ExercisePicker
			{exercises}
			onSelect={addExerciseToRoutine}
			onToggleFavorite={toggleFavorite}
		/>
	{/snippet}
	{#snippet footer()}
		<Button variant="secondary" onclick={closePicker} class="w-full sm:w-auto">
			<X class="w-4 h-4" />
			Done
		</Button>
	{/snippet}
</Modal>

<ConfirmDialog
	open={confirmDeleteOpen}
	title="Delete routine?"
	message="This will permanently remove the routine. Past sessions are not affected."
	confirmText="Delete"
	cancelText="Cancel"
	confirmVariant="danger"
	onconfirm={confirmDelete}
	oncancel={() => (confirmDeleteOpen = false)}
/>
