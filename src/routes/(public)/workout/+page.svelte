<script lang="ts">
	import Dexie from 'dexie';
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import type { Workout, Exercise, Session, SessionExercise, ExerciseSet } from '$lib/types';
	import { calculatePersonalRecords } from '$lib/prUtils';
	import RestTimer from '$lib/components/RestTimer.svelte';
	import XIcon from '$lib/components/XIcon.svelte';
	import EditWorkoutModal from '$lib/components/EditWorkoutModal.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { Trash2, Undo } from 'lucide-svelte';
	import { Button, Card, Modal, ConfirmDialog, NumberSpinner, Textarea, InfoBox } from '$lib/ui';

	let workouts = $state<Workout[]>([]);
	let exercises = $state<Exercise[]>([]);
	let selectedWorkout = $state<Workout | null>(null);
	let sessionExercises = $state<SessionExercise[]>([]);
	let currentExerciseIndex = $state(0);
	let currentSetIndex = $state(0);
	let showTimer = $state(false);
	let sessionStartTime = $state<number>(0);
	let sessionNotes = $state('');
	let showWorkoutSelector = $state(true);
	let showCompleteModal = $state(false);
	let sessionDuration = $state(0);
	let durationInterval: number | null = null;
	let editingSetIndex = $state<number | null>(null);
	let showEditModal = $state(false);
	let editingWorkout = $state<Workout | null>(null);
	let showDeleteConfirm = $state(false);
	let deletingSetIndex = $state<number | null>(null);
	let deletedSet = $state<{ exerciseIndex: number; setIndex: number; set: ExerciseSet } | null>(null);
	let undoTimeout: number | null = null;
	let showUndoToast = $state(false);
	let editingSetReps = $state<number>(0);
	let editingSetWeight = $state<number>(0);
	let editingSetRPE = $state<number | undefined>(undefined);
	let showSaveError = $state(false);
	let saveErrorMessage = $state('');
	let editingExerciseIndex = $state<number | null>(null);
	let editingExerciseName = $state('');
	let editingExerciseNotes = $state('');
	let showExerciseSaveError = $state(false);
	let exerciseSaveErrorMessage = $state('');

	onMount(async () => {
		workouts = await db.workouts.toArray();
		exercises = await db.exercises.toArray();

		const saved = localStorage.getItem('gym-app-settings');
		if (saved) {
			try {
				const settings = JSON.parse(saved);
				defaultRestDuration = settings.defaultRestDuration || 90;
			} catch (e) {
				console.error('Failed to parse settings:', e);
			}
		}
	});

	const currentExercise = $derived.by(() => {
		if (sessionExercises.length === 0 || currentExerciseIndex >= sessionExercises.length) {
			return null;
		}
		return sessionExercises[currentExerciseIndex];
	});

	const currentSet = $derived.by(() => {
		if (!currentExercise || currentSetIndex >= currentExercise.sets.length) {
			return null;
		}
		return currentExercise.sets[currentSetIndex];
	});

	const isLastSetInExercise = $derived.by(() => {
		if (!currentExercise) return false;
		return currentSetIndex === currentExercise.sets.length - 1;
	});

	const isLastExercise = $derived.by(() => {
		return currentExerciseIndex === sessionExercises.length - 1;
	});

	const isAllSetsCompleted = $derived.by(() => {
		if (sessionExercises.length === 0) return true;

		return sessionExercises.every((exercise) =>
			exercise.sets.every((set) => set.completed)
		);
	});

	function selectWorkout(workout: Workout) {
		selectedWorkout = workout;
		loadSessionProgress();

		if (sessionExercises.length === 0 || sessionExercises.every((ex) => ex.sets.length === 0)) {
			sessionExercises = workout.exercises.map((routine) => {
				const exercise = exercises.find((e) => e.id === routine.exerciseId);
				const sets: ExerciseSet[] = [];
				for (let i = 0; i < routine.targetSets; i++) {
					sets.push({
						reps: routine.targetReps,
						weight: routine.targetWeight,
						completed: false,
						notes: ''
					});
				}

				return {
					exerciseId: routine.exerciseId,
					exerciseName: routine.exerciseName,
					primaryMuscle: exercise?.primary_muscle || '',
					sets,
					notes: routine.notes
				};
			});
		}

		showWorkoutSelector = false;
		if (sessionStartTime === 0) {
			sessionStartTime = Date.now();
			startDurationTracking();
		}
	}

	async function completeSession() {
		if (!selectedWorkout) return;

		const session: Session = {
			id: Date.now().toString(),
			workoutId: selectedWorkout.id,
			workoutName: selectedWorkout.name,
			exercises: sessionExercises,
			date: new Date().toISOString(),
			duration: sessionDuration,
			notes: sessionNotes.trim() || undefined,
			createdAt: new Date().toISOString()
		};

		await db.sessions.add(Dexie.deepClone(session));
		await calculatePersonalRecords();

		localStorage.removeItem(`gym-app-session-${selectedWorkout.id}`);

		window.location.href = '/';
	}

	function startDurationTracking() {
		durationInterval = window.setInterval(() => {
			sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000 / 60);
		}, 1000);
	}

	function stopDurationTracking() {
		if (durationInterval) {
			clearInterval(durationInterval);
			durationInterval = null;
		}
	}

	function completeSet() {
		if (!currentSet) return;

		currentSet.completed = true;
		sessionExercises = [...sessionExercises];
		saveSessionProgress();

		if (isLastSetInExercise) {
			if (isLastExercise) {
				showCompleteModal = true;
				stopDurationTracking();
			} else {
				currentExerciseIndex++;
				currentSetIndex = 0;
				showTimer = true;
			}
		} else {
			currentSetIndex++;
			showTimer = true;
		}
	}

	function saveSessionProgress() {
		if (!selectedWorkout) return;
		localStorage.setItem(
			`gym-app-session-${selectedWorkout.id}`,
			JSON.stringify({
				sessionExercises,
				currentExerciseIndex,
				currentSetIndex,
				sessionStartTime,
				sessionDuration
			})
		);
	}

	function loadSessionProgress() {
		if (!selectedWorkout) return;
		const saved = localStorage.getItem(`gym-app-session-${selectedWorkout.id}`);
		if (saved) {
			try {
				const data = JSON.parse(saved);
				sessionExercises = data.sessionExercises || sessionExercises;
				sessionExercises = sessionExercises.map((ex: SessionExercise) => ({
					...ex,
					notes: ex.notes || undefined
				}));
				currentExerciseIndex = data.currentExerciseIndex || 0;
				currentSetIndex = data.currentSetIndex || 0;
				if (data.sessionStartTime) {
					sessionStartTime = data.sessionStartTime;
					startDurationTracking();
				}
				if (data.sessionDuration !== undefined) {
					sessionDuration = data.sessionDuration;
				}
			} catch (e) {
				console.error('Failed to load session progress:', e);
			}
		}
	}

	async function copyWorkout(workout: Workout) {
		const copiedWorkout: Workout = {
			id: Date.now().toString(),
			name: `${workout.name} (Copy)`,
			exercises: workout.exercises.map((exercise) => ({
				exerciseId: exercise.exerciseId,
				exerciseName: exercise.exerciseName,
				targetSets: exercise.targetSets,
				targetReps: exercise.targetReps,
				targetWeight: exercise.targetWeight
			})),
			notes: workout.notes,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		await db.workouts.add(copiedWorkout);
		workouts = await db.workouts.toArray();
	}

	function openEditModal(workout: Workout) {
		editingWorkout = workout;
		showEditModal = true;
	}

	function closeEditModal() {
		showEditModal = false;
		editingWorkout = null;
	}

	async function handleWorkoutUpdated(updatedWorkout: Workout) {
		workouts = await db.workouts.toArray();
		if (selectedWorkout?.id === updatedWorkout.id) {
			selectedWorkout = updatedWorkout;
		}
	}

	function editSet(setIndex: number) {
		if (!currentExercise) return;

		const set = currentExercise.sets[setIndex];
		editingSetReps = set.reps;
		editingSetWeight = set.weight;
		editingSetRPE = set.rpe;
		currentSetIndex = setIndex;
		showTimer = false;
		editingSetIndex = setIndex;
		showSaveError = false;
	}

	function saveSetEdit() {
		if (editingSetIndex === null || !currentExercise) return;

		const validation = validateSetValues(editingSetReps, editingSetWeight, editingSetRPE);

		if (!validation.valid) {
			showSaveError = true;
			saveErrorMessage = validation.error || 'Invalid values';
			return;
		}

		try {
			currentExercise.sets[editingSetIndex].reps = editingSetReps;
			currentExercise.sets[editingSetIndex].weight = editingSetWeight;
			currentExercise.sets[editingSetIndex].rpe = editingSetRPE || undefined;

			sessionExercises = [...sessionExercises];
			saveSessionProgress();

			editingSetIndex = null;
			showSaveError = false;
			toastStore.showSuccess('Set updated successfully');
		} catch (error) {
			console.error('Failed to save set:', error);
			showSaveError = true;
			saveErrorMessage = 'Failed to save set. Please try again.';
		}
	}

	function cancelSetEdit() {
		editingSetIndex = null;
	}

	function updateSetNotes(e: Event) {
		if (!currentSet) return;
		const textarea = e.target as HTMLTextAreaElement;
		currentSet.notes = textarea.value;
	}

	function skipCurrentSet() {
		if (!currentSet) return;

		currentSet.completed = false;
		sessionExercises = [...sessionExercises];

		if (isLastSetInExercise) {
			if (isLastExercise) {
				showCompleteModal = true;
				stopDurationTracking();
			} else {
				currentExerciseIndex++;
				currentSetIndex = 0;
				showTimer = true;
			}
		} else {
			currentSetIndex++;
			showTimer = true;
		}
	}

	function updateSetReps(e: Event) {
		if (!currentSet) return;
		const input = e.target as HTMLInputElement;
		currentSet.reps = parseInt(input.value) || 0;
		sessionExercises = [...sessionExercises];
	}

	function updateSetWeight(e: Event) {
		if (!currentSet) return;
		const input = e.target as HTMLInputElement;
		currentSet.weight = parseInt(input.value) || 0;
		sessionExercises = [...sessionExercises];
	}

	function goToNextSet() {
		showTimer = false;
	}

	function goToPreviousExercise() {
		if (currentExerciseIndex > 0) {
			currentExerciseIndex--;
			currentSetIndex = 0;
		}
	}

	function goToNextExercise() {
		if (currentExerciseIndex < sessionExercises.length - 1) {
			currentExerciseIndex++;
			currentSetIndex = 0;
		}
	}

	function goBack() {
		if (sessionStartTrackingRunning && sessionStartTime) {
			if (confirm('Are you sure you want to exit? Your progress will be lost.')) {
				window.location.href = '/';
			}
		} else {
			window.location.href = '/';
		}
	}

	const sessionStartTrackingRunning = $derived(durationInterval !== null);

	let defaultRestDuration = $state(90);
	let loadedSettings = $state(false);
	let draggedSetIndex = $state<number | null>(null);
	let draggedOverSetIndex = $state<number | null>(null);

	$effect(() => {
		if (!loadedSettings) {
			const saved = localStorage.getItem('gym-app-settings');
			if (saved) {
				try {
					const settings = JSON.parse(saved);
					defaultRestDuration = settings.defaultRestDuration || 90;
				} catch (e) {
					console.error('Failed to parse settings:', e);
				}
			}
			loadedSettings = true;
		}
	});

	function moveSetUp(index: number) {
		if (index <= 0) return;
		if (!currentExercise) return;

		const sets = [...currentExercise.sets];
		[sets[index], sets[index - 1]] = [sets[index - 1], sets[index]];
		currentExercise.sets = sets;
		sessionExercises = [...sessionExercises];
		saveSessionProgress();
	}

	function moveSetDown(index: number) {
		if (!currentExercise || index >= currentExercise.sets.length - 1) return;

		const sets = [...currentExercise.sets];
		[sets[index], sets[index + 1]] = [sets[index + 1], sets[index]];
		currentExercise.sets = sets;
		sessionExercises = [...sessionExercises];
		saveSessionProgress();
	}

	function handleDragStart(e: DragEvent, index: number) {
		draggedSetIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', index.toString());
		}
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		draggedOverSetIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDrop(e: DragEvent, index: number) {
		e.preventDefault();
		if (draggedSetIndex === null || draggedSetIndex === index) {
			draggedSetIndex = null;
			draggedOverSetIndex = null;
			return;
		}

		if (!currentExercise) return;

		const sets = [...currentExercise.sets];
		const [movedSet] = sets.splice(draggedSetIndex, 1);
		sets.splice(index, 0, movedSet);

		currentExercise.sets = sets;
		sessionExercises = [...sessionExercises];
		saveSessionProgress();

		draggedSetIndex = null;
		draggedOverSetIndex = null;
	}

	function handleDragEnd() {
		draggedSetIndex = null;
		draggedOverSetIndex = null;
	}

	function handleTouchStart(e: TouchEvent, index: number) {
		if (!currentExercise) return;
		const touch = e.touches[0];
		draggedSetIndex = index;
	}

	function handleTouchMove(e: TouchEvent, index: number) {
		e.preventDefault();
		draggedOverSetIndex = index;
	}

	function handleTouchEnd(e: TouchEvent, index: number) {
		if (draggedSetIndex === null || draggedSetIndex === index) {
			draggedSetIndex = null;
			draggedOverSetIndex = null;
			return;
		}

		if (!currentExercise) return;

		const sets = [...currentExercise.sets];
		const [movedSet] = sets.splice(draggedSetIndex, 1);
		sets.splice(index, 0, movedSet);

		currentExercise.sets = sets;
		sessionExercises = [...sessionExercises];
		saveSessionProgress();

		draggedSetIndex = null;
		draggedOverSetIndex = null;
	}

	function confirmDeleteSet(setIndex: number) {
		deletingSetIndex = setIndex;
		showDeleteConfirm = true;
	}

	function deleteSet() {
		if (deletingSetIndex === null || !currentExercise) return;

		const setToDelete = currentExercise.sets[deletingSetIndex];
		deletedSet = {
			exerciseIndex: currentExerciseIndex,
			setIndex: deletingSetIndex,
			set: { ...setToDelete }
		};

		currentExercise.sets.splice(deletingSetIndex, 1);

		if (currentSetIndex >= currentExercise.sets.length) {
			currentSetIndex = Math.max(0, currentExercise.sets.length - 1);
		}
		if (currentExercise.sets.length === 0) {
			currentSetIndex = 0;
		}

		sessionExercises = [...sessionExercises];
		saveSessionProgress();
		showDeleteConfirm = false;
		showUndoToast = true;
		deletingSetIndex = null;

		undoTimeout = window.setTimeout(() => {
			showUndoToast = false;
			deletedSet = null;
			undoTimeout = null;
		}, 30000);

		if (currentExercise.sets.length === 0 && sessionExercises.length > 1) {
			if (confirm(`All sets removed from ${currentExercise.exerciseName}. Delete this exercise?`)) {
				sessionExercises.splice(currentExerciseIndex, 1);
				currentExerciseIndex = Math.max(0, currentExerciseIndex - 1);
				currentSetIndex = 0;
				sessionExercises = [...sessionExercises];
				saveSessionProgress();
			}
		}
	}

	function cancelDeleteSet() {
		showDeleteConfirm = false;
		deletingSetIndex = null;
	}

	function confirmDeleteExercise(exerciseIndex: number) {
		deletingExerciseIndex = exerciseIndex;
		showDeleteExerciseConfirm = true;
	}

	function deleteExercise() {
		if (deletingExerciseIndex === null) return;

		const exerciseToDelete = sessionExercises[deletingExerciseIndex];
		deletedExercise = {
			exerciseIndex: deletingExerciseIndex,
			exercise: { ...exerciseToDelete }
		};

		sessionExercises.splice(deletingExerciseIndex, 1);

		if (currentExerciseIndex >= sessionExercises.length) {
			currentExerciseIndex = Math.max(0, sessionExercises.length - 1);
		}
		currentSetIndex = 0;

		sessionExercises = [...sessionExercises];
		saveSessionProgress();
		showDeleteExerciseConfirm = false;
		showExerciseUndoToast = true;
		deletingExerciseIndex = null;

		exerciseUndoTimeout = window.setTimeout(() => {
			showExerciseUndoToast = false;
			deletedExercise = null;
			exerciseUndoTimeout = null;
		}, 30000);

		if (sessionExercises.length === 0) {
			showCompleteModal = true;
			stopDurationTracking();
		}
	}

	function cancelDeleteExercise() {
		showDeleteExerciseConfirm = false;
		deletingExerciseIndex = null;
	}

	function undoDeleteExercise() {
		if (!deletedExercise || exerciseUndoTimeout === null) return;

		clearTimeout(exerciseUndoTimeout);
		exerciseUndoTimeout = null;

		try {
			sessionExercises.splice(deletedExercise.exerciseIndex, 0, deletedExercise.exercise);
			currentExerciseIndex = deletedExercise.exerciseIndex;
			currentSetIndex = 0;

			sessionExercises = [...sessionExercises];
			saveSessionProgress();
			showExerciseUndoToast = false;
			deletedExercise = null;
			toastStore.showSuccess('Exercise restored successfully');
		} catch (error) {
			console.error('Failed to undo deletion:', error);
			toastStore.showError('Failed to undo deletion');
		}
	}

	function validateSetValues(reps: number, weight: number, rpe?: number): { valid: boolean; error?: string } {
		if (reps < 0 || isNaN(reps)) {
			return { valid: false, error: 'Reps must be a non-negative number' };
		}
		if (weight < 0 || isNaN(weight)) {
			return { valid: false, error: 'Weight must be a non-negative number' };
		}
		if (rpe !== undefined && (rpe < 1 || rpe > 10 || isNaN(rpe))) {
			return { valid: false, error: 'RPE must be between 1 and 10' };
		}
		return { valid: true };
	}

	function handleSetBlur() {
		if (editingSetIndex !== null) {
			saveSetEdit();
		}
	}

	function handleSetKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveSetEdit();
		} else if (e.key === 'Escape') {
			cancelSetEdit();
		}
	}

	function calculateSessionVolume(): number {
		return sessionExercises.reduce((total, exercise) => {
			return total + exercise.sets.reduce((exerciseTotal, set) => {
				return exerciseTotal + (set.reps * set.weight);
			}, 0);
		}, 0);
	}

	function undoDeleteSet() {
		if (!deletedSet || !currentExercise) return;

		if (undoTimeout) {
			clearTimeout(undoTimeout);
			undoTimeout = null;
		}

		try {
			if (deletedSet.exerciseIndex === currentExerciseIndex) {
				currentExercise.sets.splice(deletedSet.setIndex, 0, deletedSet.set);
				currentSetIndex = deletedSet.setIndex;
			} else {
				const exercise = sessionExercises[deletedSet.exerciseIndex];
				if (exercise) {
					exercise.sets.splice(deletedSet.setIndex, 0, deletedSet.set);
				}
			}
			sessionExercises = [...sessionExercises];
			saveSessionProgress();
			showUndoToast = false;
			deletedSet = null;
			toastStore.showSuccess('Set restored successfully');
		} catch (error) {
			console.error('Failed to undo deletion:', error);
			toastStore.showError('Failed to undo deletion');
		}
	}

	function isLibraryExercise(exerciseId: string): boolean {
		const exercise = exercises.find((e) => e.id === exerciseId);
		return exercise ? !exercise.is_custom : false;
	}

	function editExercise(index: number) {
		const exercise = sessionExercises[index];
		if (!exercise) return;

		editingExerciseName = exercise.exerciseName;
		editingExerciseNotes = exercise.notes || '';
		editingExerciseIndex = index;
		showExerciseSaveError = false;
		showTimer = false;
	}

	function saveExerciseEdit() {
		saveExerciseEditWithRetry();
	}

	function cancelExerciseEdit() {
		editingExerciseIndex = null;
		showExerciseSaveError = false;
		exerciseSaveRetries = 0;
	}

	function validateExerciseValues(name: string, notes: string): { valid: boolean; error?: string } {
		if (!name.trim()) {
			return { valid: false, error: 'Exercise name is required' };
		}
		return { valid: true };
	}

	function handleExerciseBlur() {
		if (editingExerciseIndex !== null) {
			saveExerciseEdit();
		}
	}

	function handleExerciseKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveExerciseEdit();
		} else if (e.key === 'Escape') {
			cancelExerciseEdit();
		}
	}

	let exerciseSaveRetries = $state(0);
	let showDeleteExerciseConfirm = $state(false);
	let deletingExerciseIndex = $state<number | null>(null);
	let deletedExercise = $state<{ exerciseIndex: number; exercise: SessionExercise } | null>(null);
	let exerciseUndoTimeout: number | null = null;
	let showExerciseUndoToast = $state(false);

	async function saveExerciseEditWithRetry(): Promise<boolean> {
		if (editingExerciseIndex === null) return false;

		const exercise = sessionExercises[editingExerciseIndex];
		if (!exercise) return false;

		const validation = validateExerciseValues(editingExerciseName, editingExerciseNotes);
		if (!validation.valid) {
			showExerciseSaveError = true;
			exerciseSaveErrorMessage = validation.error || 'Invalid values';
			return false;
		}

		const maxRetries = 3;
		let attempt = 0;

		while (attempt < maxRetries) {
			try {
				exercise.exerciseName = editingExerciseName.trim();
				exercise.notes = editingExerciseNotes.trim() || undefined;

				sessionExercises = [...sessionExercises];
				saveSessionProgress();

				editingExerciseIndex = null;
				showExerciseSaveError = false;
				exerciseSaveRetries = 0;
				toastStore.showSuccess('Exercise updated successfully');
				return true;
			} catch (error) {
				exerciseSaveRetries = attempt + 1;
				attempt++;
				console.error(`Failed to save exercise (attempt ${attempt}):`, error);

				if (attempt < maxRetries) {
					await new Promise(resolve => setTimeout(resolve, 500 * attempt));
				} else {
					showExerciseSaveError = true;
					exerciseSaveErrorMessage = `Failed to save after ${maxRetries} attempts. Please try again.`;
					toastStore.showError('Failed to save exercise');
				}
			}
		}
		return false;
	}

	</script>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-4xl mx-auto w-full">
		{#if showWorkoutSelector}
			<Card>
				{#snippet children()}
					<div class="flex items-center justify-between mb-4 sm:mb-6">
						<h1 class="text-xl sm:text-2xl font-bold font-display text-text-primary">Select Workout</h1>
						<Button variant="ghost" href="/">Cancel</Button>
					</div>

					{#if workouts.length === 0}
						<div class="text-center py-8">
							<p class="text-text-secondary mb-4">No workouts created yet.</p>
							<Button variant="primary" href="/">
								Create a Workout
							</Button>
						</div>
					{:else}
						<div class="space-y-3">
							{#each workouts as workout}
								<div class="border border-border rounded-lg hover:bg-accent/5 hover:border-accent/50 transition-colors">
									<div class="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
										<button
											onclick={() => selectWorkout(workout)}
											class="flex-1 text-left min-h-[44px] flex items-center"
											type="button"
										>
											<div>
												<h3 class="font-semibold text-text-primary text-base sm:text-lg">{workout.name}</h3>
												<p class="text-sm text-text-secondary">
													{workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
												</p>
											</div>
										</button>
										<div class="flex gap-2">
											<Button
												variant="secondary"
												size="sm"
												onclick={(e: MouseEvent) => {
													e.stopPropagation();
													openEditModal(workout);
												}}
											>
												Edit
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onclick={(e: MouseEvent) => {
													e.stopPropagation();
													copyWorkout(workout);
												}}
											>
												Copy
											</Button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{/snippet}
			</Card>
		{:else}
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-6 mb-4 sm:mb-6">
				<div>
					<Button variant="ghost" href="/">← Exit</Button>
				</div>
				<h1 class="text-lg sm:text-xl font-bold font-display text-text-primary text-center sm:text-auto">{selectedWorkout?.name}</h1>
				<div class="text-sm text-accent font-medium text-center sm:text-auto min-h-[44px] flex items-center justify-center sm:justify-end">
					⏱️ {sessionDuration}m
				</div>
			</div>

			{#if showTimer}
				<div class="mb-6">
					<RestTimer
						duration={defaultRestDuration}
						onComplete={goToNextSet}
						onSkip={goToNextSet}
					/>
				</div>
			{/if}

			{#if currentExercise}
				<Card class="mb-4 sm:mb-6">
					{#snippet children()}
						<div class="flex items-center justify-between mb-3 sm:mb-4">
							<div class="flex-1 min-w-0">
								{#if editingExerciseIndex === currentExerciseIndex}
									<div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
										<input
											type="text"
											bind:value={editingExerciseName}
											onblur={handleExerciseBlur}
											onkeydown={handleExerciseKeyDown}
											disabled={isLibraryExercise(currentExercise.exerciseId)}
											class="flex-1 px-3 py-2 text-lg font-bold bg-surface-elevated border border-border rounded focus:ring-2 focus:ring-accent text-text-primary min-h-[44px]"
											aria-label="Exercise name"
										/>
										{#if isLibraryExercise(currentExercise.exerciseId)}
											<p class="text-xs text-text-muted italic sm:self-center">Library exercise name cannot be edited</p>
										{/if}
									</div>
								{:else}
									<h2 class="text-xl sm:text-2xl font-bold font-display text-text-primary truncate">{currentExercise.exerciseName}</h2>
								{/if}
							</div>
							<div class="flex items-center gap-2 flex-shrink-0">
								<p class="text-xs sm:text-sm text-text-secondary capitalize">{currentExercise.primaryMuscle}</p>
								{#if editingExerciseIndex !== currentExerciseIndex}
									<Button
										variant="secondary"
										size="sm"
										onclick={() => editExercise(currentExerciseIndex)}
									>
										Edit
									</Button>
									<Button
										variant="danger"
										size="sm"
										onclick={() => confirmDeleteExercise(currentExerciseIndex)}
									>
										Delete
									</Button>
								{/if}
							</div>
						</div>

						{#if editingExerciseIndex === currentExerciseIndex}
							<div class="mb-4 p-4 bg-surface-elevated rounded-lg border border-border">
								<div class="space-y-3">
									<div>
										<label for="exercise-notes" class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
											Exercise Notes (optional)
										</label>
										<textarea
											id="exercise-notes"
											bind:value={editingExerciseNotes}
											onblur={handleExerciseBlur}
											onkeydown={handleExerciseKeyDown}
											placeholder="Add notes about this exercise..."
											rows="2"
											class="w-full px-3 py-2 text-sm sm:text-base bg-surface border border-border rounded-lg focus:ring-2 focus:ring-accent text-text-primary placeholder:text-text-muted min-h-[44px]"
										></textarea>
									</div>
									{#if showExerciseSaveError}
										<InfoBox variant="error">
											<p class="text-xs mb-2">{exerciseSaveErrorMessage}</p>
											{#if exerciseSaveRetries > 0}
												<Button
													variant="danger"
													size="sm"
													onclick={() => saveExerciseEditWithRetry()}
												>
													Retry ({exerciseSaveRetries}/3)
												</Button>
											{/if}
										</InfoBox>
									{/if}
									<div class="flex items-center gap-2">
										<Button variant="success" size="sm" onclick={() => saveExerciseEdit()}>
											Save
										</Button>
										<Button variant="secondary" size="sm" onclick={() => cancelExerciseEdit()}>
											Cancel
										</Button>
									</div>
								</div>
							</div>
						{/if}

						{#if currentExercise.notes && editingExerciseIndex !== currentExerciseIndex}
							<InfoBox variant="warning" class="mb-3 sm:mb-4">
								<strong>Notes:</strong> {currentExercise.notes}
							</InfoBox>
						{/if}

						{#if !showTimer && currentSet}
							<div class="mb-4 sm:mb-6">
								<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
									<h3 class="text-base sm:text-lg font-semibold text-text-primary">
										Set {currentSetIndex + 1} / {currentExercise.sets.length}
									</h3>
									<div class="flex gap-2 justify-center sm:justify-start">
										{#if currentExerciseIndex > 0}
											<Button variant="secondary" size="sm" onclick={goToPreviousExercise}>
												← Prev
											</Button>
										{/if}
										{#if currentExerciseIndex < sessionExercises.length - 1}
											<Button variant="secondary" size="sm" onclick={goToNextExercise}>
												Next →
											</Button>
										{/if}
									</div>
								</div>

								<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
									<NumberSpinner
										label="Reps"
										bind:value={currentSet.reps}
										min={0}
										step={1}
										onchange={() => { sessionExercises = [...sessionExercises]; saveSessionProgress(); }}
									/>
									<NumberSpinner
										label="Weight (lbs)"
										bind:value={currentSet.weight}
										min={0}
										step={5}
										onchange={() => { sessionExercises = [...sessionExercises]; saveSessionProgress(); }}
									/>
								</div>

								<div class="mb-4">
									<Textarea
										label="Notes (optional)"
										bind:value={currentSet.notes}
										placeholder="Add notes about this set..."
										rows={2}
									/>
								</div>

								<div class="grid grid-cols-2 gap-3">
									<Button variant="success" onclick={completeSet} class="py-3 sm:py-4">
										✓ <span class="hidden sm:inline">Complete</span>
									</Button>
									<Button variant="secondary" onclick={skipCurrentSet} class="py-3 sm:py-4">
										Skip
									</Button>
								</div>
							</div>
						{:else}
							<div class="text-center py-4">
								<p class="text-sm sm:text-base text-text-secondary">
									{currentSetIndex} / {currentExercise.sets.length} sets completed
								</p>
							</div>
						{/if}

						<div class="mt-3 sm:mt-4">
							<div class="flex items-center justify-between mb-2">
								<h4 class="text-xs sm:text-sm font-medium text-text-secondary">
									Progress ({currentExercise.sets.filter((s) => s.completed).length} / {currentExercise.sets.length} sets)
								</h4>
							</div>
							<div class="space-y-1" role="list">
								{#each currentExercise.sets as set, idx}
									<div
										role="listitem"
										draggable={true}
										ondragstart={(e) => handleDragStart(e, idx)}
										ondragover={(e) => handleDragOver(e, idx)}
										ondrop={(e) => handleDrop(e, idx)}
										ondragend={handleDragEnd}
										ontouchstart={(e) => handleTouchStart(e, idx)}
										ontouchmove={(e) => handleTouchMove(e, idx)}
										ontouchend={(e) => handleTouchEnd(e, idx)}
										aria-grabbed={draggedSetIndex === idx}
										aria-dropeffect={draggedOverSetIndex !== null && draggedSetIndex !== null ? 'move' : 'none'}
										class="{draggedSetIndex === idx ? 'opacity-50' : ''} {draggedOverSetIndex === idx && draggedSetIndex !== null ? 'border-t-2 border-b-2 border-accent' : ''}"
									>
										<div
											class="w-full flex items-center gap-2 p-2 sm:p-3 rounded {set.completed
												? 'bg-success/10 border border-success/30 hover:bg-success/15'
												: idx === currentSetIndex
													? 'bg-accent/10 border border-accent/30'
													: 'bg-surface-elevated border border-border hover:bg-surface-hover'} transition-colors"
										>
											<div class="flex flex-col gap-1 flex-shrink-0">
												<button
													onclick={(e) => { e.stopPropagation(); moveSetUp(idx); }}
													disabled={idx === 0}
													class="px-1.5 py-0.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded {idx === 0 ? 'opacity-30 cursor-not-allowed' : ''} min-w-[32px] min-h-[24px]"
													type="button"
													aria-label="Move set up"
												>
													<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
													</svg>
												</button>
												<button
													onclick={(e) => { e.stopPropagation(); moveSetDown(idx); }}
													disabled={idx >= currentExercise.sets.length - 1}
													class="px-1.5 py-0.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded {idx >= currentExercise.sets.length - 1 ? 'opacity-30 cursor-not-allowed' : ''} min-w-[32px] min-h-[24px]"
													type="button"
													aria-label="Move set down"
												>
													<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
													</svg>
												</button>
											</div>
											<div class="cursor-grab active:cursor-grabbing flex-shrink-0 p-1 text-text-muted hover:text-text-secondary" role="button" aria-label="Drag to reorder this set" tabindex="0" onmousedown={(e) => e.preventDefault()}>
												<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
													<path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
												</svg>
											</div>
											{#if editingSetIndex === idx}
												<div class="flex-1 flex flex-col gap-2">
													<div class="grid grid-cols-3 gap-2">
														<div>
															<label for="edit-set-reps" class="block text-xs text-text-secondary mb-1">Reps</label>
															<input
																id="edit-set-reps"
																type="number"
																min="0"
																bind:value={editingSetReps}
																onblur={handleSetBlur}
																onkeydown={handleSetKeyDown}
																class="w-full px-2 py-1 text-sm bg-surface border border-border rounded focus:ring-2 focus:ring-accent text-text-primary min-h-[32px]"
															/>
														</div>
														<div>
															<label for="edit-set-weight" class="block text-xs text-text-secondary mb-1">Weight (lbs)</label>
															<input
																id="edit-set-weight"
																type="number"
																min="0"
																step="0.5"
																bind:value={editingSetWeight}
																onblur={handleSetBlur}
																onkeydown={handleSetKeyDown}
																class="w-full px-2 py-1 text-sm bg-surface border border-border rounded focus:ring-2 focus:ring-accent text-text-primary min-h-[32px]"
															/>
														</div>
														<div>
															<label for="edit-set-rpe" class="block text-xs text-text-secondary mb-1">RPE (1-10)</label>
															<input
																id="edit-set-rpe"
																type="number"
																min="1"
																max="10"
																step="0.5"
																bind:value={editingSetRPE}
																onblur={handleSetBlur}
																onkeydown={handleSetKeyDown}
																class="w-full px-2 py-1 text-sm bg-surface border border-border rounded focus:ring-2 focus:ring-accent text-text-primary min-h-[32px]"
															/>
														</div>
													</div>
													{#if showSaveError}
														<InfoBox variant="error">
															<p class="text-xs">{saveErrorMessage}</p>
														</InfoBox>
													{/if}
													<div class="flex items-center gap-2">
														<Button
															variant="success"
															size="sm"
															onclick={(e: MouseEvent) => { e.stopPropagation(); saveSetEdit(); }}
														>
															Save
														</Button>
														<Button
															variant="secondary"
															size="sm"
															onclick={(e: MouseEvent) => { e.stopPropagation(); cancelSetEdit(); }}
														>
															Cancel
														</Button>
														<span class="text-xs text-text-secondary ml-auto">
															Volume: {calculateSessionVolume().toLocaleString()} lbs
														</span>
													</div>
												</div>
											{:else}
												<button
													onclick={() => editSet(idx)}
													class="flex-1 flex items-center gap-2 text-left min-h-[44px]"
													type="button"
												>
													<span class="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-xs sm:text-sm font-medium {set.completed
														? 'bg-success text-bg'
														: idx === currentSetIndex
															? 'bg-accent text-bg'
															: 'bg-surface-hover text-text-secondary'}">
														{set.completed ? '✓' : idx + 1}
													</span>
													<div class="flex-1 min-w-0">
														<p class="text-xs sm:text-sm text-text-primary">
															{set.reps} reps @ {set.weight} lbs
															{#if set.rpe}
																<span class="text-text-muted">· RPE {set.rpe}</span>
															{/if}
														</p>
														{#if set.notes}
															<p class="text-xs text-text-muted truncate">{set.notes}</p>
														{/if}
													</div>
													{#if set.completed && idx !== currentSetIndex}
														<span class="text-xs text-success font-medium">Edit</span>
													{:else if !set.completed && idx === currentSetIndex}
														<span class="text-xs text-accent font-medium">Current</span>
													{/if}
												</button>
											{/if}
											<button
												onclick={(e) => { e.stopPropagation(); confirmDeleteSet(idx); }}
												class="px-2 py-1 text-danger hover:text-danger-muted hover:bg-danger/10 rounded transition-colors min-w-[32px] min-h-[32px]"
												type="button"
												aria-label="Delete set"
											>
												<Trash2 class="w-4 h-4 sm:w-5 sm:h-5" />
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/snippet}
				</Card>
			{/if}

			<Modal
				open={showCompleteModal}
				title="Complete Workout"
				onclose={() => (showCompleteModal = false)}
			>
				{#snippet children()}
					<div class="space-y-4 mb-6">
						<InfoBox variant="info">
							<h3 class="font-semibold mb-2">Summary</h3>
							<p class="text-sm">Duration: {sessionDuration} minutes</p>
							<p class="text-sm">Exercises: {sessionExercises.length}</p>
							<p class="text-sm">Sets: {sessionExercises.reduce((acc, ex) => acc + ex.sets.length, 0)}</p>
							<p class="text-sm">Total Volume: {calculateSessionVolume().toLocaleString()} lbs</p>
						</InfoBox>

						<Textarea
							label="Notes (optional)"
							bind:value={sessionNotes}
							placeholder="How did your workout go?"
							rows={3}
						/>
					</div>
				{/snippet}
				{#snippet footer()}
					<Button variant="ghost" onclick={() => (showCompleteModal = false)}>
						Back to Workout
					</Button>
					<Button variant="success" onclick={completeSession}>
						Save Workout
					</Button>
				{/snippet}
			</Modal>

			<ConfirmDialog
				open={showDeleteConfirm}
				title="Delete Set"
				message="Are you sure you want to delete {deletedSet?.set.reps || currentExercise?.sets[deletingSetIndex || 0]?.reps} reps @ {deletedSet?.set.weight || currentExercise?.sets[deletingSetIndex || 0]?.weight} lbs?"
				confirmText="Delete Set"
				confirmVariant="danger"
				onconfirm={deleteSet}
				oncancel={cancelDeleteSet}
			/>

			<ConfirmDialog
				open={showDeleteExerciseConfirm}
				title="Delete Exercise"
				message="Are you sure you want to delete {deletedExercise?.exercise.exerciseName || currentExercise?.exerciseName}? This will remove all sets from this exercise. You can undo this action within 30 seconds."
				confirmText="Delete Exercise"
				confirmVariant="danger"
				onconfirm={deleteExercise}
				oncancel={cancelDeleteExercise}
			/>

			{#if showUndoToast}
				<div class="fixed bottom-20 left-4 right-4 z-[100] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md">
					<div class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border bg-warning/10 border-warning/30 text-warning">
						<Undo class="w-5 h-5 flex-shrink-0" />
						<span class="text-sm font-medium flex-1">Set deleted. Undo available for 30 seconds</span>
						<button
							onclick={undoDeleteSet}
							class="px-3 py-1.5 bg-warning text-bg rounded-lg font-medium text-sm hover:bg-warning-muted transition-colors"
						>
							Undo
						</button>
						<button
							onclick={() => showUndoToast = false}
							class="flex-shrink-0 p-1 rounded hover:bg-warning/20 transition-colors"
							aria-label="Dismiss"
							type="button"
						>
							<XIcon class="w-4 h-4" />
						</button>
					</div>
				</div>
			{/if}

			{#if showExerciseUndoToast}
				<div class="fixed bottom-20 left-4 right-4 z-[100] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md">
					<div class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border bg-warning/10 border-warning/30 text-warning">
						<Undo class="w-5 h-5 flex-shrink-0" />
						<span class="text-sm font-medium flex-1">Exercise deleted. Undo available for 30 seconds</span>
						<button
							onclick={undoDeleteExercise}
							class="px-3 py-1.5 bg-warning text-bg rounded-lg font-medium text-sm hover:bg-warning-muted transition-colors"
						>
							Undo
						</button>
						<button
							onclick={() => showExerciseUndoToast = false}
							class="flex-shrink-0 p-1 rounded hover:bg-warning/20 transition-colors"
							aria-label="Dismiss"
							type="button"
						>
							<XIcon class="w-4 h-4" />
						</button>
					</div>
				</div>
			{/if}
		{/if}

		{#if showEditModal && editingWorkout}
			<EditWorkoutModal
				workout={editingWorkout}
				onClose={closeEditModal}
				onWorkoutUpdated={handleWorkoutUpdated}
			/>
		{/if}
	</div>
</div>
