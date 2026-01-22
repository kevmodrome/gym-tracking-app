<script lang="ts">
	import Dexie from 'dexie';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import type { Session, SessionExercise, ExerciseSet } from '$lib/types';
	import { calculatePersonalRecords } from '$lib/prUtils';
	import WorkoutProgressBar from '$lib/components/WorkoutProgressBar.svelte';
	import SetPage from '$lib/components/SetPage.svelte';
	import TimerPage from '$lib/components/TimerPage.svelte';
	import CompletionPage from '$lib/components/CompletionPage.svelte';
	import SessionOverflowMenu from '$lib/components/SessionOverflowMenu.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { ArrowLeft, Undo } from 'lucide-svelte';
	import { Button, Modal, ConfirmDialog, Textarea, NumberSpinner, TextInput } from '$lib/ui';
	import { invalidateSessions, invalidatePersonalRecords } from '$lib/invalidation';

	let { data } = $props();

	// Data from load function
	const workout = $derived(data.workout);
	const exercises = $derived(data.exercises);
	const workoutId = $derived(data.workoutId);

	// Session state
	let sessionExercises = $state<SessionExercise[]>([]);
	let currentExerciseIndex = $state(0);
	let currentSetIndex = $state(0);
	let sessionStartTime = $state<number>(0);
	let sessionNotes = $state('');
	let sessionDuration = $state(0);
	let durationInterval: number | null = null;
	let loading = $state(true);
	let defaultRestDuration = $state(90);

	// View state: 'set' | 'timer' | 'complete'
	let currentView = $state<'set' | 'timer' | 'complete'>('set');

	// Last completed set info (for timer display)
	let lastCompletedSet = $state<{ reps: number; weight: number; setNumber: number; exerciseName: string } | null>(null);

	// Modal states
	let showExitConfirm = $state(false);

	// Overflow menu action modals
	let showNoteModal = $state(false);
	let showRPEModal = $state(false);
	let showDeleteSetConfirm = $state(false);
	let showEditExerciseModal = $state(false);
	let showDeleteExerciseConfirm = $state(false);

	// Editing state for modals
	let editingNote = $state('');
	let editingRPE = $state<number>(5);
	let editingExerciseName = $state('');

	// Undo state
	let deletedSet = $state<{ exerciseIndex: number; setIndex: number; set: ExerciseSet } | null>(null);
	let showUndoToast = $state(false);
	let undoTimeout: number | null = null;

	// Derived state
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

	const isFirstSet = $derived.by(() => {
		return currentExerciseIndex === 0 && currentSetIndex === 0;
	});

	// Next set info for timer
	const nextSetInfo = $derived.by(() => {
		if (currentView !== 'timer') return null;
		const exercise = sessionExercises[currentExerciseIndex];
		if (!exercise) return null;

		return {
			exerciseName: exercise.exerciseName,
			setNumber: currentSetIndex + 1,
			totalSets: exercise.sets.length,
			targetReps: exercise.sets[currentSetIndex]?.reps ?? 0,
			targetWeight: exercise.sets[currentSetIndex]?.weight ?? 0
		};
	});

	onMount(() => {
		if (!workout) {
			goto('/workout');
			return;
		}

		// Load settings
		const saved = localStorage.getItem('gym-app-settings');
		if (saved) {
			try {
				const settings = JSON.parse(saved);
				defaultRestDuration = settings.defaultRestDuration || 90;
			} catch (e) {
				console.error('Failed to parse settings:', e);
			}
		}

		// Load or initialize session
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

		if (sessionStartTime === 0) {
			sessionStartTime = Date.now();
			startDurationTracking();
		}

		loading = false;
	});

	// Duration tracking
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

	// Session persistence
	function saveSessionProgress() {
		if (!workout) return;
		localStorage.setItem(
			`gym-app-session-${workout.id}`,
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
		if (!workout) return;
		const saved = localStorage.getItem(`gym-app-session-${workout.id}`);
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

	// Set actions
	function completeSet() {
		if (!currentSet || !currentExercise) return;

		// Store what was just completed for display during rest
		lastCompletedSet = {
			reps: currentSet.reps,
			weight: currentSet.weight,
			setNumber: currentSetIndex + 1,
			exerciseName: currentExercise.exerciseName
		};

		currentSet.completed = true;
		sessionExercises = [...sessionExercises];
		saveSessionProgress();

		if (isLastSetInExercise) {
			if (isLastExercise) {
				currentView = 'complete';
				stopDurationTracking();
			} else {
				currentExerciseIndex++;
				currentSetIndex = 0;
				currentView = 'timer';
			}
		} else {
			currentSetIndex++;
			currentView = 'timer';
		}
	}

	function skipSet() {
		if (!currentSet) return;

		currentSet.completed = false;
		sessionExercises = [...sessionExercises];

		if (isLastSetInExercise) {
			if (isLastExercise) {
				currentView = 'complete';
				stopDurationTracking();
			} else {
				currentExerciseIndex++;
				currentSetIndex = 0;
				currentView = 'timer';
			}
		} else {
			currentSetIndex++;
			currentView = 'timer';
		}
	}

	function startTimer() {
		currentView = 'timer';
	}

	function onTimerComplete() {
		currentView = 'set';
		lastCompletedSet = null;
	}

	function onTimerSkip() {
		currentView = 'set';
		lastCompletedSet = null;
	}

	function onTimerBack() {
		currentView = 'set';
	}

	// Navigation
	function goBack() {
		if (currentView === 'timer') {
			// From timer, go back to current set
			currentView = 'set';
			return;
		}

		// From set view
		if (isFirstSet) {
			// First set of first exercise - confirm exit
			showExitConfirm = true;
		} else if (currentSetIndex === 0) {
			// First set of non-first exercise - go to last set of previous exercise
			currentExerciseIndex--;
			currentSetIndex = sessionExercises[currentExerciseIndex].sets.length - 1;
		} else {
			// Go to previous set in current exercise
			currentSetIndex--;
		}
		saveSessionProgress();
	}

	function handleSetClick(exerciseIndex: number, setIndex: number) {
		currentExerciseIndex = exerciseIndex;
		currentSetIndex = setIndex;
		currentView = 'set';
		saveSessionProgress();
	}

	function onSetChange() {
		sessionExercises = [...sessionExercises];
		saveSessionProgress();
	}

	// Session completion
	async function completeSession() {
		if (!workout) return;

		const session: Session = {
			id: Date.now().toString(),
			workoutId: workout.id,
			workoutName: workout.name,
			exercises: sessionExercises,
			date: new Date().toISOString(),
			duration: sessionDuration,
			notes: sessionNotes.trim() || undefined,
			createdAt: new Date().toISOString()
		};

		await db.sessions.add(Dexie.deepClone(session));
		await calculatePersonalRecords();
		await invalidateSessions();
		await invalidatePersonalRecords();

		localStorage.removeItem(`gym-app-session-${workout.id}`);

		goto('/');
	}

	// Overflow menu actions
	function isLibraryExercise(exerciseId: string): boolean {
		const exercise = exercises.find((e) => e.id === exerciseId);
		return exercise ? !exercise.is_custom : false;
	}

	function openNoteModal() {
		editingNote = currentSet?.notes || '';
		showNoteModal = true;
	}

	function saveNote() {
		if (currentSet) {
			currentSet.notes = editingNote.trim() || undefined;
			sessionExercises = [...sessionExercises];
			saveSessionProgress();
			toastStore.showSuccess('Note saved');
		}
		showNoteModal = false;
	}

	function openRPEModal() {
		editingRPE = currentSet?.rpe || 5;
		showRPEModal = true;
	}

	function saveRPE() {
		if (currentSet) {
			currentSet.rpe = editingRPE;
			sessionExercises = [...sessionExercises];
			saveSessionProgress();
			toastStore.showSuccess('RPE saved');
		}
		showRPEModal = false;
	}

	function confirmDeleteSet() {
		showDeleteSetConfirm = true;
	}

	function deleteSet() {
		if (!currentExercise) return;

		const setToDelete = currentExercise.sets[currentSetIndex];
		deletedSet = {
			exerciseIndex: currentExerciseIndex,
			setIndex: currentSetIndex,
			set: { ...setToDelete }
		};

		currentExercise.sets.splice(currentSetIndex, 1);

		if (currentSetIndex >= currentExercise.sets.length) {
			currentSetIndex = Math.max(0, currentExercise.sets.length - 1);
		}

		sessionExercises = [...sessionExercises];
		saveSessionProgress();
		showDeleteSetConfirm = false;
		showUndoToast = true;

		undoTimeout = window.setTimeout(() => {
			showUndoToast = false;
			deletedSet = null;
			undoTimeout = null;
		}, 30000);

		// If no sets left, offer to delete exercise
		if (currentExercise.sets.length === 0 && sessionExercises.length > 1) {
			showDeleteExerciseConfirm = true;
		}
	}

	function undoDeleteSet() {
		if (!deletedSet) return;

		if (undoTimeout) {
			clearTimeout(undoTimeout);
			undoTimeout = null;
		}

		const exercise = sessionExercises[deletedSet.exerciseIndex];
		if (exercise) {
			exercise.sets.splice(deletedSet.setIndex, 0, deletedSet.set);
			currentExerciseIndex = deletedSet.exerciseIndex;
			currentSetIndex = deletedSet.setIndex;
		}

		sessionExercises = [...sessionExercises];
		saveSessionProgress();
		showUndoToast = false;
		deletedSet = null;
		toastStore.showSuccess('Set restored');
	}

	function openEditExerciseModal() {
		if (currentExercise) {
			editingExerciseName = currentExercise.exerciseName;
			showEditExerciseModal = true;
		}
	}

	function saveExerciseName() {
		if (currentExercise && editingExerciseName.trim()) {
			currentExercise.exerciseName = editingExerciseName.trim();
			sessionExercises = [...sessionExercises];
			saveSessionProgress();
			toastStore.showSuccess('Exercise updated');
		}
		showEditExerciseModal = false;
	}

	function confirmDeleteExercise() {
		showDeleteExerciseConfirm = true;
	}

	function deleteExercise() {
		if (currentExerciseIndex === null) return;

		sessionExercises.splice(currentExerciseIndex, 1);

		if (currentExerciseIndex >= sessionExercises.length) {
			currentExerciseIndex = Math.max(0, sessionExercises.length - 1);
		}
		currentSetIndex = 0;

		sessionExercises = [...sessionExercises];
		saveSessionProgress();
		showDeleteExerciseConfirm = false;

		if (sessionExercises.length === 0) {
			currentView = 'complete';
			stopDurationTracking();
		}
	}
</script>

<svelte:head>
	<title>{workout?.name ?? 'Session'} - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-bg flex flex-col">
	{#if loading}
		<div class="flex items-center justify-center min-h-screen">
			<div class="text-text-muted">Loading workout...</div>
		</div>
	{:else if !workout}
		<div class="flex items-center justify-center min-h-screen">
			<div class="text-center p-4">
				<p class="text-text-secondary mb-4">Workout not found</p>
				<Button variant="primary" href="/workout">Back to Workouts</Button>
			</div>
		</div>
	{:else if sessionExercises.length === 0}
		<div class="flex items-center justify-center min-h-screen">
			<div class="text-center p-4">
				<h2 class="text-xl font-bold text-text-primary mb-2">No Exercises</h2>
				<p class="text-text-secondary mb-4">This workout doesn't have any exercises yet.</p>
				<div class="flex flex-col sm:flex-row gap-3 justify-center">
					<Button variant="secondary" href="/workout/{workout.id}">
						Edit Workout
					</Button>
					<Button variant="ghost" href="/workout">
						Choose Different Workout
					</Button>
				</div>
			</div>
		</div>
	{:else if currentView === 'complete'}
		<!-- Completion Page (Full Screen) -->
		<CompletionPage
			{sessionDuration}
			{sessionExercises}
			{sessionNotes}
			onNotesChange={(notes) => (sessionNotes = notes)}
			onBack={() => (currentView = 'set')}
			onSave={completeSession}
		/>
	{:else}
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
			<button
				onclick={goBack}
				class="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors min-h-[44px] min-w-[44px]"
				type="button"
			>
				<ArrowLeft class="w-5 h-5" />
				<span class="hidden sm:inline">Back</span>
			</button>

			<div class="text-sm text-accent font-medium">
				⏱️ {sessionDuration}m
			</div>

			<SessionOverflowMenu
				onAddNote={openNoteModal}
				onSetRPE={openRPEModal}
				onDeleteSet={confirmDeleteSet}
				onEditExercise={openEditExerciseModal}
				onDeleteExercise={confirmDeleteExercise}
				isLibraryExercise={currentExercise ? isLibraryExercise(currentExercise.exerciseId) : false}
			/>
		</div>

		<!-- Progress Bar -->
		{#if currentExercise}
			<WorkoutProgressBar
				exercises={sessionExercises}
				currentExerciseIndex={currentExerciseIndex}
				currentSetIndex={currentSetIndex}
				currentExerciseName={currentExercise.exerciseName}
				onSetClick={handleSetClick}
			/>
		{/if}

		<!-- Main Content -->
		<div class="flex-1 flex flex-col">
			{#if currentView === 'timer' && nextSetInfo}
				<TimerPage
					duration={defaultRestDuration}
					nextExerciseName={nextSetInfo.exerciseName}
					nextSetNumber={nextSetInfo.setNumber}
					nextTotalSets={nextSetInfo.totalSets}
					nextTargetReps={nextSetInfo.targetReps}
					nextTargetWeight={nextSetInfo.targetWeight}
					lastCompletedReps={lastCompletedSet?.reps}
					lastCompletedWeight={lastCompletedSet?.weight}
					lastCompletedSetNumber={lastCompletedSet?.setNumber}
					onComplete={onTimerComplete}
					onSkip={onTimerSkip}
					onBack={onTimerBack}
				/>
			{:else if currentExercise}
				<SetPage
					exercise={currentExercise}
					setIndex={currentSetIndex}
					onComplete={completeSet}
					onSkip={skipSet}
					onStartTimer={startTimer}
					onOpenMenu={() => {}}
					onSetChange={onSetChange}
				/>
			{/if}
		</div>
	{/if}

	<!-- Exit Confirm Dialog -->
	<ConfirmDialog
		open={showExitConfirm}
		title="Exit Workout?"
		message="Your progress will be saved. You can continue this workout later."
		confirmText="Exit"
		confirmVariant="secondary"
		onconfirm={() => goto('/workout')}
		oncancel={() => (showExitConfirm = false)}
	/>

	<!-- Note Modal -->
	<Modal
		open={showNoteModal}
		title="Add Note"
		onclose={() => (showNoteModal = false)}
	>
		{#snippet children()}
			<Textarea
				label="Note for this set"
				bind:value={editingNote}
				placeholder="Add notes about this set..."
				rows={3}
			/>
		{/snippet}
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (showNoteModal = false)}>
				Cancel
			</Button>
			<Button variant="primary" onclick={saveNote}>
				Save Note
			</Button>
		{/snippet}
	</Modal>

	<!-- RPE Modal -->
	<Modal
		open={showRPEModal}
		title="Set RPE"
		onclose={() => (showRPEModal = false)}
	>
		{#snippet children()}
			<div class="py-4">
				<p class="text-sm text-text-secondary mb-4">Rate of Perceived Exertion (1-10)</p>
				<NumberSpinner
					bind:value={editingRPE}
					min={1}
					max={10}
					step={0.5}
					size="lg"
				/>
				<p class="text-xs text-text-muted mt-2 text-center">
					1 = Very easy • 10 = Maximum effort
				</p>
			</div>
		{/snippet}
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (showRPEModal = false)}>
				Cancel
			</Button>
			<Button variant="primary" onclick={saveRPE}>
				Save RPE
			</Button>
		{/snippet}
	</Modal>

	<!-- Edit Exercise Modal -->
	<Modal
		open={showEditExerciseModal}
		title="Edit Exercise"
		onclose={() => (showEditExerciseModal = false)}
	>
		{#snippet children()}
			<TextInput
				label="Exercise Name"
				bind:value={editingExerciseName}
				placeholder="Exercise name"
			/>
		{/snippet}
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (showEditExerciseModal = false)}>
				Cancel
			</Button>
			<Button variant="primary" onclick={saveExerciseName}>
				Save
			</Button>
		{/snippet}
	</Modal>

	<!-- Delete Set Confirm -->
	<ConfirmDialog
		open={showDeleteSetConfirm}
		title="Delete Set?"
		message="You can undo this within 30 seconds."
		confirmText="Delete Set"
		confirmVariant="danger"
		onconfirm={deleteSet}
		oncancel={() => (showDeleteSetConfirm = false)}
	/>

	<!-- Delete Exercise Confirm -->
	<ConfirmDialog
		open={showDeleteExerciseConfirm}
		title="Delete Exercise?"
		message="Delete {currentExercise?.exerciseName}? This cannot be undone."
		confirmText="Delete Exercise"
		confirmVariant="danger"
		onconfirm={deleteExercise}
		oncancel={() => (showDeleteExerciseConfirm = false)}
	/>

	<!-- Undo Toast -->
	{#if showUndoToast}
		<div class="fixed bottom-20 left-4 right-4 z-[100] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md">
			<div class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border bg-warning/10 border-warning/30 text-warning">
				<Undo class="w-5 h-5 flex-shrink-0" />
				<span class="text-sm font-medium flex-1">Set deleted</span>
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
					×
				</button>
			</div>
		</div>
	{/if}
</div>
