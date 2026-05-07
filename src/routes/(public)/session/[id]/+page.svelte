<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import type { Session, SessionExercise, ExerciseSet, Exercise, SetWeight } from '$lib/types';
	import { volumeWeight } from '$lib/types';
	import { calculatePersonalRecords, getRepRangeLabel } from '$lib/prUtils';
	import { calculateSessionVolume, calculateStreakDays } from '$lib/dashboardMetrics';
	import type { PersonalRecord } from '$lib/types';
	import WorkoutProgressBar from '$lib/components/WorkoutProgressBar.svelte';
	import SetPage from '$lib/components/SetPage.svelte';
	import TimerPage from '$lib/components/TimerPage.svelte';
	import WorkoutFinishCelebration from '$lib/components/WorkoutFinishCelebration.svelte';
	import SessionOverflowMenu from '$lib/components/SessionOverflowMenu.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import { ArrowLeft, Undo, Plus, Search, Star, Check, Timer } from 'lucide-svelte';
	import { Button, Modal, ConfirmDialog, TextInput } from '$lib/ui';

	let { data } = $props();

	const sessionId = $derived(data.sessionId);
	const fromSessionId = $derived(data.fromSessionId);

	const exercisesCol = db.collection('exercises');
	const sessionsCol = db.collection('sessions');

	async function tryGetSession(id: string): Promise<Session | null> {
		try {
			return await sessionsCol.get(id) as Session;
		} catch {
			return null;
		}
	}

	let exercises = $state<Exercise[]>([]);
	let existingSession = $state<Session | null>(null);
	let sourceSession = $state<Session | null>(null);

	$effect(() => {
		exercisesCol.get().then((data) => {
			exercises = data as Exercise[];
		});
	});

	$effect(() => {
		tryGetSession(sessionId).then((data) => {
			existingSession = data;
		});
	});

	$effect(() => {
		if (fromSessionId) {
			tryGetSession(fromSessionId).then((data) => {
				sourceSession = data;
			});
		} else {
			sourceSession = null;
		}
	});

	// Session state
	let sessionExercises = $state<SessionExercise[]>([]);
	let currentExerciseIndex = $state(0);
	let currentSetIndex = $state(0);
	let sessionStartTime = $state<number>(0);
	let sessionNotes = $state('');
	let sessionDuration = $state(0);
	let durationInterval: number | null = null;
	let loading = $state(true);

	// View state: 'set' | 'complete' | 'picker'
	// Timer is now an overlay (sticky-bar by default, expanded when timerExpanded).
	let currentView = $state<'set' | 'complete' | 'picker'>('picker');

	// Timer overlay state — runs alongside SetPage, never replaces it.
	let timerRunning = $state(false);
	let timerExpanded = $state(false);
	let activeTimerDuration = $state(90);

	// Exercise picker state
	let showExercisePicker = $state(false);
	let exerciseSearchQuery = $state('');
	let selectedMuscleFilter = $state<string>('all');
	let selectedExerciseIds = $state<Set<string>>(new Set());

	// Last completed set info (for timer display)
	let lastCompletedSet = $state<{ reps: number; weight: SetWeight; setNumber: number; exerciseName: string } | null>(null);

	// Modal states
	let showExitConfirm = $state(false);

	// Overflow menu action modals
	let showDeleteSetConfirm = $state(false);
	let showEditExerciseModal = $state(false);
	let showDeleteExerciseConfirm = $state(false);

	// Editing state for modals
	let editingExerciseName = $state('');

	// Undo state
	let deletedSet = $state<{ exerciseIndex: number; setIndex: number; set: ExerciseSet } | null>(null);
	let showUndoToast = $state(false);
	let undoTimeout: number | null = null;

	// Celebration state — computed once at finish time
	interface DetectedPR {
		exerciseName: string;
		repRange: string;
		weight: number;
		reps: number;
		previousBest?: { weight: number; reps: number };
	}
	let celebrationVolumeDelta = $state(0);
	let celebrationPRs = $state<DetectedPR[]>([]);
	let celebrationStreakDays = $state(0);

	// PRs by exerciseId, used by SetPage to show PRBadge inline
	let prsByExerciseId = $state<Record<string, PersonalRecord[]>>({});

	// Load all current PRs once for inline PRBadge detection
	$effect(() => {
		db.collection('personalRecords').get().then((records) => {
			const map: Record<string, PersonalRecord[]> = {};
			for (const r of records as PersonalRecord[]) {
				if (!map[r.exerciseId]) map[r.exerciseId] = [];
				map[r.exerciseId].push(r);
			}
			prsByExerciseId = map;
		});
	});

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

	const currentExercisePRs = $derived.by(() => {
		if (!currentExercise) return [] as PersonalRecord[];
		return prsByExerciseId[currentExercise.exerciseId] ?? [];
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

	const selectedCount = $derived(selectedExerciseIds.size);

	// Next set info for timer
	const nextSetInfo = $derived.by(() => {
		if (!timerRunning) return null;
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

	// Resolve the rest duration: prefer per-exercise restSeconds (Task 6),
	// else fall back to user's global default.
	function resolveRestDuration(): number {
		const ex = sessionExercises[currentExerciseIndex];
		if (ex) {
			const lib = exercises.find((e) => e.id === ex.exerciseId);
			if (lib?.restSeconds && lib.restSeconds > 0) {
				return lib.restSeconds;
			}
		}
		return preferencesStore.defaultRestSeconds || 90;
	}

	onMount(() => {
		// Initialize from source session if copying from an old session
		if (sourceSession && sessionExercises.length === 0) {
			sessionExercises = sourceSession.exercises.map((exercise) => ({
				exerciseId: exercise.exerciseId,
				exerciseName: exercise.exerciseName,
				primaryMuscle: exercise.primaryMuscle,
				sets: exercise.sets.map((set) => ({
					reps: set.reps,
					weight: set.weight,
					completed: false
				}))
			}));
		} else {
			// Load session progress from localStorage
			loadSessionProgress();
		}

		// If no exercises yet, show the picker to start adding
		if (sessionExercises.length === 0) {
			currentView = 'picker';
		} else {
			currentView = 'set';
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
		localStorage.setItem(
			`gym-app-session-${sessionId}`,
			JSON.stringify({
				sessionExercises,
				currentExerciseIndex,
				currentSetIndex,
				sessionStartTime,
				sessionDuration,
				sessionNotes
			})
		);
	}

	function loadSessionProgress() {
		const saved = localStorage.getItem(`gym-app-session-${sessionId}`);
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
				sessionNotes = data.sessionNotes || '';
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
				timerRunning = false;
				timerExpanded = false;
				finishWorkout();
			} else {
				currentExerciseIndex++;
				currentSetIndex = 0;
				startTimer();
			}
		} else {
			currentSetIndex++;
			startTimer();
		}
	}

	function skipSet() {
		if (!currentSet) return;

		currentSet.completed = false;
		sessionExercises = [...sessionExercises];

		if (isLastSetInExercise) {
			if (isLastExercise) {
				timerRunning = false;
				timerExpanded = false;
				finishWorkout();
			} else {
				currentExerciseIndex++;
				currentSetIndex = 0;
				startTimer();
			}
		} else {
			currentSetIndex++;
			startTimer();
		}
	}

	function startTimer() {
		activeTimerDuration = resolveRestDuration();
		timerRunning = true;
		timerExpanded = false;
	}

	function onTimerComplete() {
		// Auto-collapse the sticky bar when the timer hits zero. Audio +
		// vibration are handled inside the Timer class.
		timerRunning = false;
		timerExpanded = false;
		lastCompletedSet = null;
	}

	function onTimerSkip() {
		timerRunning = false;
		timerExpanded = false;
		lastCompletedSet = null;
	}

	function expandTimer() {
		timerExpanded = true;
	}

	function collapseTimer() {
		timerExpanded = false;
	}

	// Navigation
	function goBack() {
		// If timer is expanded, collapse it instead of navigating away.
		if (timerExpanded) {
			timerExpanded = false;
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

	async function finishWorkout() {
		currentView = 'complete';
		stopDurationTracking();
		await computeCelebrationData();
	}

	async function computeCelebrationData() {
		// Volume delta vs last completed session (excluding the current/in-progress one)
		const allSessions = (await db
			.collection('sessions')
			.orderBy('date')
			.reverse()
			.get()) as Session[];

		const priorSessions = allSessions.filter((s) => s.id !== sessionId);
		const currentVolume = calculateSessionVolume({ exercises: sessionExercises });

		if (priorSessions.length > 0) {
			const lastVolume = calculateSessionVolume({ exercises: priorSessions[0].exercises });
			celebrationVolumeDelta = currentVolume - lastVolume;
		} else {
			celebrationVolumeDelta = 0;
		}

		// Detect PRs by comparing current session sets against existing PRs (BEFORE save).
		// Group new bests per exerciseId+reps so each unique rep/exercise appears only once.
		const detected: DetectedPR[] = [];
		const seen = new Set<string>();

		for (const ex of sessionExercises) {
			const existingPRs = prsByExerciseId[ex.exerciseId] ?? [];
			// Find the best (heaviest) completed, non-warmup, numeric-weight set per reps
			const bestPerReps = new Map<number, { weight: number; reps: number }>();
			for (const set of ex.sets) {
				if (!set.completed) continue;
				if (set.warmup) continue;
				if (typeof set.weight !== 'number' || !Number.isFinite(set.weight)) continue;
				const cur = bestPerReps.get(set.reps);
				if (!cur || set.weight > cur.weight) {
					bestPerReps.set(set.reps, { weight: set.weight, reps: set.reps });
				}
			}

			for (const [reps, best] of bestPerReps) {
				const key = `${ex.exerciseId}-${reps}`;
				if (seen.has(key)) continue;
				const existing = existingPRs.find((pr) => pr.reps === reps);
				if (!existing || best.weight > existing.weight) {
					seen.add(key);
					detected.push({
						exerciseName: ex.exerciseName,
						repRange: getRepRangeLabel(reps),
						weight: best.weight,
						reps: best.reps,
						previousBest: existing
							? { weight: existing.weight, reps: existing.reps }
							: undefined
					});
				}
			}
		}

		// Sort detected PRs: heaviest first
		detected.sort((a, b) => b.weight - a.weight);
		celebrationPRs = detected;

		// Streak: include this session in the calc by appending a synthetic
		// "today" session if no prior session occurred today.
		const today = new Date();
		const todayStr = (() => {
			const y = today.getFullYear();
			const m = String(today.getMonth() + 1).padStart(2, '0');
			const d = String(today.getDate()).padStart(2, '0');
			return `${y}-${m}-${d}`;
		})();
		const hasTodaySession = priorSessions.some((s) => {
			const d = new Date(s.date);
			const y = d.getFullYear();
			const m = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			return `${y}-${m}-${day}` === todayStr;
		});
		const sessionsForStreak = hasTodaySession
			? priorSessions
			: [
					...priorSessions,
					{
						id: sessionId,
						exercises: sessionExercises,
						date: today.toISOString(),
						duration: sessionDuration,
						createdAt: today.toISOString()
					} satisfies Session
			  ];
		celebrationStreakDays = calculateStreakDays(sessionsForStreak, today);
	}

	// Session completion
	async function completeSession() {
		const session: Session = {
			id: sessionId,
			exercises: sessionExercises,
			date: new Date().toISOString(),
			duration: sessionDuration,
			notes: sessionNotes.trim() || undefined,
			createdAt: new Date().toISOString()
		};

		await db.collection('sessions').add({
			exercises: $state.snapshot(session.exercises),
			date: session.date,
			duration: session.duration,
			notes: session.notes,
			createdAt: session.createdAt,
		});
		await calculatePersonalRecords();

		localStorage.removeItem(`gym-app-session-${sessionId}`);

		goto('/');
	}

	// Exercise picker functions
	const filteredExercises = $derived.by(() => {
		let filtered = exercises;

		// Filter by search query
		if (exerciseSearchQuery.trim()) {
			const query = exerciseSearchQuery.toLowerCase().trim();
			filtered = filtered.filter((ex) =>
				ex.name.toLowerCase().includes(query) ||
				ex.primary_muscle.toLowerCase().includes(query)
			);
		}

		// Filter by muscle group
		if (selectedMuscleFilter !== 'all') {
			filtered = filtered.filter((ex) => ex.primary_muscle === selectedMuscleFilter);
		}

		// Sort: favorites first, then alphabetically
		return [...filtered].sort((a, b) => {
			if (a.favorited && !b.favorited) return -1;
			if (!a.favorited && b.favorited) return 1;
			return a.name.localeCompare(b.name);
		});
	});

	const muscleGroups = $derived.by(() => {
		const groups = new Set<string>();
		for (const ex of exercises) {
			groups.add(ex.primary_muscle);
		}
		return Array.from(groups).sort();
	});

	function toggleExerciseSelection(exercise: Exercise) {
		const newSet = new Set(selectedExerciseIds);
		if (newSet.has(exercise.id)) {
			newSet.delete(exercise.id);
		} else {
			newSet.add(exercise.id);
		}
		selectedExerciseIds = newSet;
	}

	async function getLastWeightForExercise(exerciseId: string): Promise<SetWeight> {
		// Get all sessions sorted by date descending (most recent first)
		const sessions = await db.collection('sessions').orderBy('date').reverse().get() as Session[];

		for (const session of sessions) {
			const exerciseData = session.exercises.find((e) => e.exerciseId === exerciseId);
			if (exerciseData && exerciseData.sets.length > 0) {
				// Return the weight from the first set of the most recent session
				return exerciseData.sets[0].weight;
			}
		}

		return 0; // Fallback to 0 if no history found
	}

	async function addSelectedExercisesToSession() {
		if (selectedExerciseIds.size === 0) {
			toastStore.showWarning('Select at least one exercise');
			return;
		}

		const defaultSets = 3;
		const defaultReps = 10;

		const selectedExercises = filteredExercises.filter((ex) => selectedExerciseIds.has(ex.id));

		// Fetch last weights for all selected exercises in parallel
		const lastWeights = await Promise.all(
			selectedExercises.map((ex) => getLastWeightForExercise(ex.id))
		);

		const newSessionExercises: SessionExercise[] = selectedExercises.map((exercise, index) => ({
			exerciseId: exercise.id,
			exerciseName: exercise.name,
			primaryMuscle: exercise.primary_muscle,
			sets: Array.from({ length: defaultSets }, () => ({
				reps: defaultReps,
				weight: lastWeights[index],
				completed: false,
				notes: ''
			}))
		}));

		sessionExercises = [...sessionExercises, ...newSessionExercises];
		saveSessionProgress();

		selectedExerciseIds = new Set();
		currentExerciseIndex = sessionExercises.length - newSessionExercises.length;
		currentSetIndex = 0;
		currentView = 'set';

		toastStore.showSuccess(
			`Added ${selectedExercises.length} exercise${selectedExercises.length > 1 ? 's' : ''}`
		);
	}

	async function toggleFavorite(exercise: Exercise) {
		const newValue = !exercise.favorited;
		await db.collection('exercises').update(exercise.id, { favorited: newValue });
		toastStore.showSuccess(newValue ? 'Added to favorites' : 'Removed from favorites');
	}

	function openExercisePicker() {
		exerciseSearchQuery = '';
		selectedMuscleFilter = 'all';
		showExercisePicker = true;
	}

	function closeExercisePicker() {
		showExercisePicker = false;
		// If we have exercises, go back to set view
		if (sessionExercises.length > 0) {
			currentView = 'set';
		}
	}

	// Overflow menu actions
	function isLibraryExercise(exerciseId: string): boolean {
		const exercise = exercises.find((e) => e.id === exerciseId);
		return exercise ? !exercise.is_custom : false;
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
			finishWorkout();
		}
	}
</script>

<svelte:head>
	<title>Session - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-bg flex flex-col">
	{#if loading}
		<div class="flex items-center justify-center min-h-screen">
			<div class="text-text-muted">Loading session...</div>
		</div>
	{:else if currentView === 'picker' || sessionExercises.length === 0}
		<!-- Exercise Picker View (Full Screen) -->
		<div class="flex-1 flex flex-col">
			<!-- Picker Header -->
			<div class="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
				<button
					onclick={() => {
						selectedExerciseIds = new Set();
						if (sessionExercises.length > 0) {
							currentView = 'set';
						} else {
							goto('/');
						}
					}}
					class="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors min-h-[44px] min-w-[44px]"
					type="button"
				>
					<ArrowLeft class="w-5 h-5" />
					<span class="hidden sm:inline">{sessionExercises.length > 0 ? 'Back' : 'Cancel'}</span>
				</button>

				<h1 class="text-lg font-semibold text-text-primary">Add Exercises</h1>

				{#if selectedCount > 0 || sessionExercises.length > 0}
					<button
						onclick={() => {
							if (selectedCount > 0) {
								addSelectedExercisesToSession();
							} else {
								currentView = 'set';
							}
						}}
						class="text-accent font-medium min-h-[44px] px-3"
						type="button"
					>
						Done{#if selectedCount > 0} ({selectedCount}){/if}
					</button>
				{:else}
					<div class="w-[44px]"></div>
				{/if}
			</div>

			<!-- Search and Filter -->
			<div class="px-4 py-3 bg-surface border-b border-border space-y-3">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
					<input
						type="text"
						placeholder="Search exercises..."
						bind:value={exerciseSearchQuery}
						class="w-full pl-10 pr-4 py-2.5 bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
					/>
				</div>

				<div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
					<button
						onclick={() => (selectedMuscleFilter = 'all')}
						class="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors {selectedMuscleFilter === 'all' ? 'bg-accent text-bg' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}"
						type="button"
					>
						All
					</button>
					{#each muscleGroups as muscle}
						<button
							onclick={() => (selectedMuscleFilter = muscle)}
							class="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors capitalize {selectedMuscleFilter === muscle ? 'bg-accent text-bg' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}"
							type="button"
						>
							{muscle}
						</button>
					{/each}
				</div>
			</div>

			<!-- Exercise List -->
			<div class="flex-1 overflow-y-auto">
				{#if filteredExercises.length === 0}
					<div class="flex items-center justify-center h-full p-8">
						<p class="text-text-muted text-center">No exercises found</p>
					</div>
				{:else}
					<div class="divide-y divide-border">
						{#each filteredExercises as exercise (exercise.id)}
							{@const isSelected = selectedExerciseIds.has(exercise.id)}
							{@const isAlreadyAdded = sessionExercises.some((se) => se.exerciseId === exercise.id)}
							<div
								class="flex items-center gap-3 px-4 py-3 transition-colors
									{isSelected ? 'bg-accent/10' : 'bg-surface hover:bg-surface-elevated'}
									{isAlreadyAdded ? 'opacity-50' : ''}"
							>
								<button
									onclick={() => toggleFavorite(exercise)}
									class="p-2 -m-2 text-text-muted hover:text-warning transition-colors"
									type="button"
									aria-label={exercise.favorited ? 'Remove from favorites' : 'Add to favorites'}
								>
									<Star class="w-5 h-5 {exercise.favorited ? 'fill-warning text-warning' : ''}" />
								</button>

								<button
									onclick={() => !isAlreadyAdded && toggleExerciseSelection(exercise)}
									class="flex-1 text-left"
									type="button"
									disabled={isAlreadyAdded}
								>
									<p class="font-medium text-text-primary">{exercise.name}</p>
									<p class="text-sm text-text-muted capitalize">
										{exercise.primary_muscle} · {exercise.category}
										{#if isAlreadyAdded}
											<span class="text-success">· Added</span>
										{/if}
									</p>
								</button>

								<button
									onclick={() => !isAlreadyAdded && toggleExerciseSelection(exercise)}
									class="w-7 h-7 rounded-full flex items-center justify-center transition-all
										{isAlreadyAdded
											? 'bg-success/20 text-success'
											: isSelected
												? 'bg-accent text-bg'
												: 'border-2 border-text-muted/30 text-transparent hover:border-accent/50'}"
									type="button"
									disabled={isAlreadyAdded}
									aria-label={isSelected ? 'Deselect' : 'Select'}
								>
									<Check class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{:else if currentView === 'complete'}
		<!-- Workout finish celebration (Full Screen) -->
		<WorkoutFinishCelebration
			session={{ exercises: sessionExercises, duration: sessionDuration }}
			volumeDelta={celebrationVolumeDelta}
			prs={celebrationPRs}
			streakDays={celebrationStreakDays}
			bind:notes={sessionNotes}
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

			<div class="flex items-center gap-3">
				<button
					onclick={() => (currentView = 'picker')}
					class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 rounded-lg transition-colors"
					type="button"
				>
					<Plus class="w-4 h-4" />
					<span class="hidden sm:inline">Add</span>
				</button>
				<span class="text-sm text-accent font-medium inline-flex items-center gap-1"><Timer class="w-4 h-4" />{sessionDuration}m</span>
			</div>

			<SessionOverflowMenu
				onDeleteSet={confirmDeleteSet}
				onEditExercise={openEditExerciseModal}
				onDeleteExercise={confirmDeleteExercise}
				onCancelWorkout={() => (showExitConfirm = true)}
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
			{#if currentExercise}
				<SetPage
					exercise={currentExercise}
					setIndex={currentSetIndex}
					onComplete={completeSet}
					onSkip={skipSet}
					onStartTimer={startTimer}
					onSetChange={onSetChange}
					onFinishWorkout={finishWorkout}
					timerActive={timerRunning}
					exercisePRs={currentExercisePRs}
				/>
			{/if}
		</div>

		<!-- Rest timer overlay: sticky bar by default, full-screen when expanded.
		     SetPage stays interactive underneath. -->
		{#if timerRunning && nextSetInfo}
			<TimerPage
				duration={activeTimerDuration}
				mode={timerExpanded ? 'expanded' : 'compact'}
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
				onExpand={expandTimer}
				onCollapse={collapseTimer}
			/>
		{/if}
	{/if}

	<!-- Exit Confirm Dialog -->
	<ConfirmDialog
		open={showExitConfirm}
		title="Exit Session?"
		message="Your progress will be saved. You can continue this session later."
		confirmText="Exit"
		onconfirm={() => {
			if (typeof localStorage !== 'undefined') {
				localStorage.removeItem(`gym-app-session-${sessionId}`);
			}
			goto('/');
		}}
		oncancel={() => (showExitConfirm = false)}
	/>

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
