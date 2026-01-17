<script lang="ts">
	import Dexie from 'dexie';
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import type { Workout, Exercise, Session, SessionExercise, ExerciseSet } from '$lib/types';
	import { calculatePersonalRecords } from '$lib/prUtils';
	import { syncManager } from '$lib/syncUtils';
	import RestTimer from '$lib/components/RestTimer.svelte';
	import XIcon from '$lib/components/XIcon.svelte';
	import EditWorkoutModal from '$lib/components/EditWorkoutModal.svelte';
	import { toastStore } from '$lib/stores/toast';
	import { Trash2, Undo } from 'lucide-svelte';

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
		await syncManager.addToSyncQueue('session', session.id, 'create', session);
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
		await syncManager.addToSyncQueue('workout', copiedWorkout.id, 'create', copiedWorkout);
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

<div class="min-h-screen bg-gray-100 p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-4xl mx-auto w-full">
		{#if showWorkoutSelector}
			<div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
				<div class="flex items-center justify-between mb-4 sm:mb-6">
					<h1 class="text-xl sm:text-2xl font-bold text-gray-900">Select Workout</h1>
					<a href="/" class="text-blue-600 hover:text-blue-800 min-h-[44px] flex items-center">Cancel</a>
				</div>

				{#if workouts.length === 0}
					<div class="text-center py-8">
						<p class="text-gray-600 mb-4">No workouts created yet.</p>
						<a
							href="/"
							class="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 min-h-[44px]"
						>
							Create a Workout
						</a>
					</div>
				{:else}
					<div class="space-y-3">
						{#each workouts as workout}
							<div class="border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
								<div class="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
									<button
										onclick={() => selectWorkout(workout)}
										class="flex-1 text-left min-h-[44px] flex items-center"
										type="button"
									>
										<div>
											<h3 class="font-semibold text-gray-900 text-base sm:text-lg">{workout.name}</h3>
											<p class="text-sm text-gray-600">
												{workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
											</p>
										</div>
									</button>
									<div class="flex gap-2">
										<button
											onclick={(e) => {
												e.stopPropagation();
												openEditModal(workout);
											}}
											class="px-3 py-1.5 sm:py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm font-medium min-h-[44px] min-w-[44px]"
											type="button"
											title="Edit workout"
										>
											Edit
										</button>
										<button
											onclick={(e) => {
												e.stopPropagation();
												copyWorkout(workout);
											}}
											class="px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium min-h-[44px] min-w-[44px]"
											type="button"
											title="Copy workout"
										>
											Copy
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-6 mb-4 sm:mb-6">
				<div>
					<a href="/" class="text-blue-600 hover:text-blue-800 min-h-[44px] flex items-center">← Exit</a>
				</div>
				<h1 class="text-lg sm:text-xl font-bold text-gray-900 text-center sm:text-auto">{selectedWorkout?.name}</h1>
				<div class="text-sm text-gray-600 text-center sm:text-auto min-h-[44px] flex items-center justify-center sm:justify-end">
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
				<div class="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
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
										class="flex-1 px-3 py-2 text-lg font-bold border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 min-h-[44px]"
										aria-label="Exercise name"
									/>
									{#if isLibraryExercise(currentExercise.exerciseId)}
										<p class="text-xs text-gray-500 italic sm:self-center">Library exercise name cannot be edited</p>
									{/if}
								</div>
							{:else}
								<h2 class="text-xl sm:text-2xl font-bold text-gray-900 truncate">{currentExercise.exerciseName}</h2>
							{/if}
						</div>
						<div class="flex items-center gap-2 flex-shrink-0">
							<p class="text-xs sm:text-sm text-gray-600 capitalize">{currentExercise.primaryMuscle}</p>
							{#if editingExerciseIndex !== currentExerciseIndex}
								<button
									onclick={() => editExercise(currentExerciseIndex)}
									class="px-3 py-1.5 text-xs sm:text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium min-h-[36px] sm:min-h-[44px]"
									type="button"
									aria-label="Edit exercise"
								>
									Edit
								</button>
								<button
									onclick={() => confirmDeleteExercise(currentExerciseIndex)}
									class="px-3 py-1.5 text-xs sm:text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors font-medium min-h-[36px] sm:min-h-[44px]"
									type="button"
									aria-label="Delete exercise"
								>
									Delete
								</button>
							{/if}
						</div>
					</div>

					{#if editingExerciseIndex === currentExerciseIndex}
						<div class="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
							<div class="space-y-3">
								<div>
									<label for="exercise-notes" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
										Exercise Notes (optional)
									</label>
									<textarea
										id="exercise-notes"
										bind:value={editingExerciseNotes}
										onblur={handleExerciseBlur}
										onkeydown={handleExerciseKeyDown}
										placeholder="Add notes about this exercise..."
										rows="2"
										class="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[44px]"
									></textarea>
								</div>
								{#if showExerciseSaveError}
									<div class="p-2 bg-red-50 border border-red-200 rounded">
										<p class="text-xs text-red-700 mb-2">{exerciseSaveErrorMessage}</p>
										{#if exerciseSaveRetries > 0}
											<button
												onclick={() => saveExerciseEditWithRetry()}
												class="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 min-h-[28px]"
												type="button"
											>
												Retry ({exerciseSaveRetries}/3)
											</button>
										{/if}
									</div>
								{/if}
								<div class="flex items-center gap-2">
									<button
										onclick={() => saveExerciseEdit()}
										class="px-4 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 min-h-[36px]"
										type="button"
									>
										Save
									</button>
									<button
										onclick={() => cancelExerciseEdit()}
										class="px-4 py-2 bg-gray-400 text-white rounded text-sm font-medium hover:bg-gray-500 min-h-[36px]"
										type="button"
									>
										Cancel
									</button>
								</div>
							</div>
						</div>
					{/if}

					{#if currentExercise.notes && editingExerciseIndex !== currentExerciseIndex}
						<div class="mb-3 sm:mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
							<p class="text-xs sm:text-sm text-yellow-800">
								<strong>Notes:</strong> {currentExercise.notes}
							</p>
						</div>
					{/if}

					{#if !showTimer && currentSet}
						<div class="mb-4 sm:mb-6">
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
								<h3 class="text-base sm:text-lg font-semibold text-gray-900">
									Set {currentSetIndex + 1} / {currentExercise.sets.length}
								</h3>
								<div class="flex gap-2 justify-center sm:justify-start">
									{#if currentExerciseIndex > 0}
										<button
											onclick={goToPreviousExercise}
											class="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm min-h-[44px]"
											type="button"
										>
											← Prev
										</button>
									{/if}
									{#if currentExerciseIndex < sessionExercises.length - 1}
										<button
											onclick={goToNextExercise}
											class="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm min-h-[44px]"
											type="button"
										>
											Next →
										</button>
									{/if}
								</div>
							</div>

							<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
								<div>
									<label for="reps-input" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
										Reps
									</label>
									<div class="flex gap-1">
										<button
											onclick={() => { if (currentSet) { currentSet.reps = Math.max(0, currentSet.reps - 1); sessionExercises = [...sessionExercises]; saveSessionProgress(); } }}
											type="button"
											class="px-3 sm:px-4 py-3 bg-gray-200 text-gray-700 rounded-l-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-lg sm:text-xl font-semibold"
											aria-label="Decrease reps"
										>
											-
										</button>
										<input
											id="reps-input"
											type="number"
											min="0"
											inputmode="numeric"
											bind:value={currentSet.reps}
											oninput={updateSetReps}
											class="flex-1 px-3 sm:px-4 py-3 text-xl sm:text-2xl font-bold text-center border-y border-gray-300 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
										/>
										<button
											onclick={() => { if (currentSet) { currentSet.reps += 1; sessionExercises = [...sessionExercises]; saveSessionProgress(); } }}
											type="button"
											class="px-3 sm:px-4 py-3 bg-gray-200 text-gray-700 rounded-r-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-lg sm:text-xl font-semibold"
											aria-label="Increase reps"
										>
											+
										</button>
									</div>
								</div>
								<div>
									<label for="weight-input" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
										Weight (lbs)
									</label>
									<div class="flex gap-1">
										<button
											onclick={() => { if (currentSet) { currentSet.weight = Math.max(0, currentSet.weight - 5); sessionExercises = [...sessionExercises]; saveSessionProgress(); } }}
											type="button"
											class="px-3 sm:px-4 py-3 bg-gray-200 text-gray-700 rounded-l-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-lg sm:text-xl font-semibold"
											aria-label="Decrease weight"
										>
											-
										</button>
										<input
											id="weight-input"
											type="number"
											min="0"
											inputmode="numeric"
											bind:value={currentSet.weight}
											oninput={updateSetWeight}
											class="flex-1 px-3 sm:px-4 py-3 text-xl sm:text-2xl font-bold text-center border-y border-gray-300 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
										/>
										<button
											onclick={() => { if (currentSet) { currentSet.weight += 5; sessionExercises = [...sessionExercises]; saveSessionProgress(); } }}
											type="button"
											class="px-3 sm:px-4 py-3 bg-gray-200 text-gray-700 rounded-r-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-lg sm:text-xl font-semibold"
											aria-label="Increase weight"
										>
											+
										</button>
									</div>
								</div>
							</div>

							<div class="mb-4">
								<label for="set-notes" class="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
									Notes (optional)
								</label>
								<textarea
									id="set-notes"
									bind:value={currentSet.notes}
									oninput={updateSetNotes}
									placeholder="Add notes about this set..."
									rows="2"
									class="w-full px-3 sm:px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[44px]"
								></textarea>
							</div>

							<div class="grid grid-cols-2 gap-3">
								<button
									onclick={completeSet}
									class="flex-1 px-3 sm:px-4 py-3 sm:py-4 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 min-h-[48px]"
									type="button"
								>
									✓ <span class="hidden sm:inline">Complete</span>
								</button>
								<button
									onclick={skipCurrentSet}
									class="flex-1 px-3 sm:px-4 py-3 sm:py-4 text-sm sm:text-base bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium min-h-[48px]"
									type="button"
								>
									Skip
								</button>
							</div>
						</div>
					{:else}
						<div class="text-center py-4">
							<p class="text-sm sm:text-base text-gray-600">
								{currentSetIndex} / {currentExercise.sets.length} sets completed
							</p>
						</div>
					{/if}

					<div class="mt-3 sm:mt-4">
						<div class="flex items-center justify-between mb-2">
							<h4 class="text-xs sm:text-sm font-medium text-gray-700">
								Progress ({currentExercise.sets.filter((s) => s.completed).length} / {currentExercise.sets.length} sets)
							</h4>
						</div>
						<div class="space-y-1">
							{#each currentExercise.sets as set, idx}
								<div
									draggable={true}
									ondragstart={(e) => handleDragStart(e, idx)}
									ondragover={(e) => handleDragOver(e, idx)}
									ondrop={(e) => handleDrop(e, idx)}
									ondragend={handleDragEnd}
									ontouchstart={(e) => handleTouchStart(e, idx)}
									ontouchmove={(e) => handleTouchMove(e, idx)}
									ontouchend={(e) => handleTouchEnd(e, idx)}
									class="{draggedSetIndex === idx ? 'opacity-50' : ''} {draggedOverSetIndex === idx && draggedSetIndex !== null ? 'border-t-2 border-b-2 border-blue-500' : ''}"
								>
									<div
										class="w-full flex items-center gap-2 p-2 sm:p-3 rounded {set.completed
											? 'bg-green-50 border border-green-200 hover:bg-green-100'
											: idx === currentSetIndex
												? 'bg-blue-50 border border-blue-200'
												: 'bg-gray-50 border border-gray-200 hover:bg-gray-100'} transition-colors"
									>
										<div class="flex flex-col gap-1 flex-shrink-0">
											<button
												onclick={(e) => { e.stopPropagation(); moveSetUp(idx); }}
												disabled={idx === 0}
												class="px-1.5 py-0.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded {idx === 0 ? 'opacity-30 cursor-not-allowed' : ''} min-w-[32px] min-h-[24px]"
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
												class="px-1.5 py-0.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded {idx >= currentExercise.sets.length - 1 ? 'opacity-30 cursor-not-allowed' : ''} min-w-[32px] min-h-[24px]"
												type="button"
												aria-label="Move set down"
											>
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
												</svg>
											</button>
										</div>
										<div class="cursor-grab active:cursor-grabbing flex-shrink-0 p-1 text-gray-400 hover:text-gray-600" onmousedown={(e) => e.preventDefault()}>
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
												<path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
											</svg>
										</div>
										{#if editingSetIndex === idx}
											<div class="flex-1 flex flex-col gap-2">
												<div class="grid grid-cols-3 gap-2">
													<div>
														<label class="block text-xs text-gray-600 mb-1">Reps</label>
														<input
															type="number"
															min="0"
															bind:value={editingSetReps}
															onblur={handleSetBlur}
															onkeydown={handleSetKeyDown}
															class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 min-h-[32px]"
														/>
													</div>
													<div>
														<label class="block text-xs text-gray-600 mb-1">Weight (lbs)</label>
														<input
															type="number"
															min="0"
															step="0.5"
															bind:value={editingSetWeight}
															onblur={handleSetBlur}
															onkeydown={handleSetKeyDown}
															class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 min-h-[32px]"
														/>
													</div>
													<div>
														<label class="block text-xs text-gray-600 mb-1">RPE (1-10)</label>
														<input
															type="number"
															min="1"
															max="10"
															step="0.5"
															bind:value={editingSetRPE}
															onblur={handleSetBlur}
															onkeydown={handleSetKeyDown}
															class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 min-h-[32px]"
														/>
													</div>
												</div>
												{#if showSaveError}
													<div class="p-2 bg-red-50 border border-red-200 rounded">
														<p class="text-xs text-red-700">{saveErrorMessage}</p>
													</div>
												{/if}
												<div class="flex items-center gap-2">
													<button
														onclick={(e) => { e.stopPropagation(); saveSetEdit(); }}
														class="px-3 py-1.5 bg-green-500 text-white rounded text-xs hover:bg-green-600 min-w-[32px] min-h-[32px]"
														type="button"
														aria-label="Save"
													>
														Save
													</button>
													<button
														onclick={(e) => { e.stopPropagation(); cancelSetEdit(); }}
														class="px-3 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-gray-500 min-w-[32px] min-h-[32px]"
														type="button"
														aria-label="Cancel"
													>
														Cancel
													</button>
													<span class="text-xs text-gray-600 ml-auto">
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
													? 'bg-green-500 text-white'
													: idx === currentSetIndex
														? 'bg-blue-500 text-white'
														: 'bg-gray-300 text-gray-600'}">
													{set.completed ? '✓' : idx + 1}
												</span>
												<div class="flex-1 min-w-0">
													<p class="text-xs sm:text-sm text-gray-700">
														{set.reps} reps @ {set.weight} lbs
														{#if set.rpe}
															<span class="text-gray-500">· RPE {set.rpe}</span>
														{/if}
													</p>
													{#if set.notes}
														<p class="text-xs text-gray-500 truncate">{set.notes}</p>
													{/if}
												</div>
												{#if set.completed && idx !== currentSetIndex}
													<span class="text-xs text-green-600 font-medium">Edit</span>
												{:else if !set.completed && idx === currentSetIndex}
													<span class="text-xs text-blue-600 font-medium">Current</span>
												{/if}
											</button>
										{/if}
										<button
											onclick={(e) => { e.stopPropagation(); confirmDeleteSet(idx); }}
											class="px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors min-w-[32px] min-h-[32px]"
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
				</div>
			{/if}

			{#if showCompleteModal}
				<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
						<div class="flex items-center justify-between mb-4">
							<h2 class="text-xl font-bold text-gray-900">Complete Workout</h2>
							<button
								onclick={() => (showCompleteModal = false)}
								type="button"
							>
								<XIcon class="w-6 h-6 text-gray-500" />
							</button>
						</div>

						<div class="space-y-4 mb-6">
							<div class="bg-blue-50 rounded-lg p-4">
								<h3 class="font-semibold text-blue-900 mb-2">Summary</h3>
								<p class="text-sm text-blue-800">Duration: {sessionDuration} minutes</p>
								<p class="text-sm text-blue-800">
									Exercises: {sessionExercises.length}
								</p>
								<p class="text-sm text-blue-800">
									Sets: {sessionExercises.reduce((acc, ex) => acc + ex.sets.length, 0)}
								</p>
								<p class="text-sm text-blue-800">
									Total Volume: {calculateSessionVolume().toLocaleString()} lbs
								</p>
							</div>

							<div>
								<label for="session-notes" class="block text-sm font-medium text-gray-700 mb-2">
									Notes (optional)
								</label>
								<textarea
									id="session-notes"
									bind:value={sessionNotes}
									placeholder="How did your workout go?"
									rows="3"
									class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[44px]"
								></textarea>
							</div>
						</div>

						<div class="flex gap-3">
							<button
								onclick={() => (showCompleteModal = false)}
								class="flex-1 px-4 py-3 text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 min-h-[44px]"
								type="button"
							>
								Back to Workout
							</button>
							<button
								onclick={completeSession}
								class="flex-1 px-4 py-3 text-base bg-green-600 text-white rounded-lg hover:bg-green-700 min-h-[44px]"
								type="button"
							>
								Save Workout
							</button>
						</div>
					</div>
				</div>
			{/if}

			{#if showDeleteConfirm}
				<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
						<div class="flex items-center justify-between mb-4">
							<h2 class="text-xl font-bold text-gray-900">Delete Set</h2>
							<button
								onclick={cancelDeleteSet}
								type="button"
							>
								<XIcon class="w-6 h-6 text-gray-500" />
							</button>
						</div>
						<p class="text-gray-700 mb-6">
							Are you sure you want to delete {deletedSet?.set.reps || currentExercise?.sets[deletingSetIndex || 0]?.reps} reps @ {deletedSet?.set.weight || currentExercise?.sets[deletingSetIndex || 0]?.weight} lbs?
						</p>
						<div class="flex gap-3">
							<button
								onclick={cancelDeleteSet}
								class="flex-1 px-4 py-3 text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 min-h-[44px]"
								type="button"
							>
								Cancel
							</button>
							<button
								onclick={deleteSet}
								class="flex-1 px-4 py-3 text-base bg-red-600 text-white rounded-lg hover:bg-red-700 min-h-[44px]"
								type="button"
							>
								Delete Set
							</button>
						</div>
					</div>
				</div>
			{/if}

			{#if showDeleteExerciseConfirm}
				<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
						<div class="flex items-center justify-between mb-4">
							<h2 class="text-xl font-bold text-gray-900">Delete Exercise</h2>
							<button
								onclick={cancelDeleteExercise}
								type="button"
							>
								<XIcon class="w-6 h-6 text-gray-500" />
							</button>
						</div>
						<p class="text-gray-700 mb-4">
							Are you sure you want to delete <strong>{deletedExercise?.exercise.exerciseName || currentExercise?.exerciseName}</strong>?
						</p>
						<p class="text-sm text-gray-600 mb-6">
							This will remove all sets from this exercise. You can undo this action within 30 seconds.
						</p>
						<div class="flex gap-3">
							<button
								onclick={cancelDeleteExercise}
								class="flex-1 px-4 py-3 text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 min-h-[44px]"
								type="button"
							>
								Cancel
							</button>
							<button
								onclick={deleteExercise}
								class="flex-1 px-4 py-3 text-base bg-red-600 text-white rounded-lg hover:bg-red-700 min-h-[44px]"
								type="button"
							>
								Delete Exercise
							</button>
						</div>
					</div>
				</div>
			{/if}

			{#if showUndoToast}
				<div class="fixed bottom-4 left-4 right-4 z-[100] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md">
					<div class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border bg-amber-50 border-amber-200 text-amber-800">
						<Undo class="w-5 h-5 flex-shrink-0 text-amber-500" />
						<span class="text-sm font-medium flex-1">Set deleted. Undo available for 30 seconds</span>
						<button
							onclick={undoDeleteSet}
							class="flex-shrink-0 px-3 py-1 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700 min-h-[32px]"
							type="button"
						>
							Undo
						</button>
						<button
							onclick={() => showUndoToast = false}
							class="flex-shrink-0 p-1 rounded hover:bg-amber-100 transition-colors"
							aria-label="Dismiss"
							type="button"
						>
							<XIcon class="w-4 h-4" />
						</button>
					</div>
				</div>
			{/if}

			{#if showExerciseUndoToast}
				<div class="fixed bottom-4 left-4 right-4 z-[100] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md">
					<div class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border bg-amber-50 border-amber-200 text-amber-800">
						<Undo class="w-5 h-5 flex-shrink-0 text-amber-500" />
						<span class="text-sm font-medium flex-1">Exercise deleted. Undo available for 30 seconds</span>
						<button
							onclick={undoDeleteExercise}
							class="flex-shrink-0 px-3 py-1 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700 min-h-[32px]"
							type="button"
						>
							Undo
						</button>
						<button
							onclick={() => showExerciseUndoToast = false}
							class="flex-shrink-0 p-1 rounded hover:bg-amber-100 transition-colors"
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
