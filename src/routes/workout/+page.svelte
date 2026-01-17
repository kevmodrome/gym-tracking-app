<script lang="ts">
	import Dexie from 'dexie';
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import type { Workout, Exercise, Session, SessionExercise, ExerciseSet } from '$lib/types';
	import { calculatePersonalRecords } from '$lib/prUtils';
	import RestTimer from '$lib/components/RestTimer.svelte';
	import XIcon from '$lib/components/XIcon.svelte';
	import EditWorkoutModal from '$lib/components/EditWorkoutModal.svelte';

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
					sets
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
		currentSetIndex = setIndex;
		showTimer = false;
		editingSetIndex = setIndex;
	}

	function saveSetEdit() {
		editingSetIndex = null;
		sessionExercises = [...sessionExercises];
		saveSessionProgress();
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
</script>

<div class="min-h-screen bg-gray-100 p-4 md:p-8">
	<div class="max-w-4xl mx-auto">
		{#if showWorkoutSelector}
			<div class="bg-white rounded-lg shadow-md p-6">
				<div class="flex items-center justify-between mb-6">
					<h1 class="text-2xl font-bold text-gray-900">Select Workout</h1>
					<a href="/" class="text-blue-600 hover:text-blue-800">Cancel</a>
				</div>

				{#if workouts.length === 0}
					<div class="text-center py-8">
						<p class="text-gray-600 mb-4">No workouts created yet.</p>
						<a
							href="/"
							class="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
						>
							Create a Workout
						</a>
					</div>
				{:else}
					<div class="space-y-3">
						{#each workouts as workout}
							<div class="border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
								<div class="p-4 flex items-center justify-between">
									<button
										onclick={() => selectWorkout(workout)}
										class="flex-1 text-left"
										type="button"
									>
										<div>
											<h3 class="font-semibold text-gray-900">{workout.name}</h3>
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
											class="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm font-medium"
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
											class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium"
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
			<div class="flex items-center justify-between mb-6">
				<div>
					<a href="/" class="text-blue-600 hover:text-blue-800">← Exit</a>
				</div>
				<h1 class="text-xl font-bold text-gray-900">{selectedWorkout?.name}</h1>
				<div class="text-sm text-gray-600">
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
				<div class="bg-white rounded-lg shadow-md p-6 mb-6">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-2xl font-bold text-gray-900">{currentExercise.exerciseName}</h2>
						<p class="text-sm text-gray-600 capitalize">{currentExercise.primaryMuscle}</p>
					</div>

					{#if !showTimer && currentSet}
						<div class="mb-6">
							<div class="flex items-center justify-between mb-3">
								<h3 class="text-lg font-semibold text-gray-900">
									Set {currentSetIndex + 1} / {currentExercise.sets.length}
								</h3>
								<div class="flex gap-2">
									{#if currentExerciseIndex > 0}
										<button
											onclick={goToPreviousExercise}
											class="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
											type="button"
										>
											← Prev Exercise
										</button>
									{/if}
									{#if currentExerciseIndex < sessionExercises.length - 1}
										<button
											onclick={goToNextExercise}
											class="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
											type="button"
										>
											Next Exercise →
										</button>
									{/if}
								</div>
							</div>

							<div class="grid grid-cols-2 gap-4 mb-4">
								<div>
									<label for="reps-input" class="block text-sm font-medium text-gray-700 mb-2">
										Reps
									</label>
									<div class="flex gap-1">
										<button
											onclick={() => { if (currentSet) { currentSet.reps = Math.max(0, currentSet.reps - 1); sessionExercises = [...sessionExercises]; saveSessionProgress(); } }}
											type="button"
											class="px-4 py-3 bg-gray-200 text-gray-700 rounded-l-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-xl font-semibold"
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
											class="flex-1 px-4 py-3 text-2xl font-bold text-center border-y border-gray-300 focus:ring-2 focus:ring-blue-500"
										/>
										<button
											onclick={() => { if (currentSet) { currentSet.reps += 1; sessionExercises = [...sessionExercises]; saveSessionProgress(); } }}
											type="button"
											class="px-4 py-3 bg-gray-200 text-gray-700 rounded-r-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-xl font-semibold"
											aria-label="Increase reps"
										>
											+
										</button>
									</div>
								</div>
								<div>
									<label for="weight-input" class="block text-sm font-medium text-gray-700 mb-2">
										Weight (lbs)
									</label>
									<div class="flex gap-1">
										<button
											onclick={() => { if (currentSet) { currentSet.weight = Math.max(0, currentSet.weight - 5); sessionExercises = [...sessionExercises]; saveSessionProgress(); } }}
											type="button"
											class="px-4 py-3 bg-gray-200 text-gray-700 rounded-l-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-xl font-semibold"
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
											class="flex-1 px-4 py-3 text-2xl font-bold text-center border-y border-gray-300 focus:ring-2 focus:ring-blue-500"
										/>
										<button
											onclick={() => { if (currentSet) { currentSet.weight += 5; sessionExercises = [...sessionExercises]; saveSessionProgress(); } }}
											type="button"
											class="px-4 py-3 bg-gray-200 text-gray-700 rounded-r-lg hover:bg-gray-300 min-w-[44px] min-h-[44px] text-xl font-semibold"
											aria-label="Increase weight"
										>
											+
										</button>
									</div>
								</div>
							</div>

							<div class="mb-4">
								<label for="set-notes" class="block text-sm font-medium text-gray-700 mb-2">
									Notes (optional)
								</label>
								<textarea
									id="set-notes"
									bind:value={currentSet.notes}
									oninput={updateSetNotes}
									placeholder="Add notes about this set..."
									rows="2"
									class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[44px]"
								></textarea>
							</div>

							<div class="flex gap-3">
								<button
									onclick={completeSet}
									class="flex-1 px-4 py-4 text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 min-h-[48px]"
									type="button"
								>
									✓ Complete Set
								</button>
								<button
									onclick={skipCurrentSet}
									class="flex-1 px-4 py-4 text-base bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium min-h-[48px]"
									type="button"
								>
									→ Skip Set
								</button>
							</div>
						</div>
					{:else}
						<div class="text-center py-4">
							<p class="text-gray-600">
								{currentSetIndex} / {currentExercise.sets.length} sets completed
							</p>
						</div>
					{/if}

					<div class="mt-4">
						<div class="flex items-center justify-between mb-2">
							<h4 class="text-sm font-medium text-gray-700">
								Progress ({currentExercise.sets.filter((s) => s.completed).length} / {currentExercise.sets.length} sets)
							</h4>
						</div>
						<div class="space-y-1">
							{#each currentExercise.sets as set, idx}
								<button
									onclick={() => editSet(idx)}
									class="w-full flex items-center gap-2 p-3 rounded {set.completed
										? 'bg-green-50 border border-green-200 hover:bg-green-100'
										: idx === currentSetIndex
											? 'bg-blue-50 border border-blue-200'
											: 'bg-gray-50 border border-gray-200 hover:bg-gray-100'} transition-colors text-left"
									type="button"
								>
									<span class="w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium {set.completed
										? 'bg-green-500 text-white'
										: idx === currentSetIndex
											? 'bg-blue-500 text-white'
											: 'bg-gray-300 text-gray-600'}">
										{set.completed ? '✓' : idx + 1}
									</span>
									<div class="flex-1 min-w-0">
										<p class="text-sm text-gray-700">
											{set.reps} reps @ {set.weight} lbs
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
