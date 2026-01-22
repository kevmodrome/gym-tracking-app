<script lang="ts">
	import type { SessionExercise } from '$lib/types';

	interface WorkoutProgressBarProps {
		exercises: SessionExercise[];
		currentExerciseIndex: number;
		currentSetIndex: number;
		currentExerciseName: string;
		onSetClick?: (exerciseIndex: number, setIndex: number) => void;
	}

	let {
		exercises,
		currentExerciseIndex,
		currentSetIndex,
		currentExerciseName,
		onSetClick
	}: WorkoutProgressBarProps = $props();

	// Flatten all sets into a linear array for the progress bar
	interface FlatSet {
		exerciseIndex: number;
		setIndex: number;
		completed: boolean;
		exerciseName: string;
	}

	const flatSets = $derived.by(() => {
		const sets: FlatSet[] = [];
		exercises.forEach((exercise, exIdx) => {
			exercise.sets.forEach((set, setIdx) => {
				sets.push({
					exerciseIndex: exIdx,
					setIndex: setIdx,
					completed: set.completed,
					exerciseName: exercise.exerciseName
				});
			});
		});
		return sets;
	});

	// Find the current flat index
	const currentFlatIndex = $derived.by(() => {
		let idx = 0;
		for (let i = 0; i < currentExerciseIndex; i++) {
			idx += exercises[i].sets.length;
		}
		return idx + currentSetIndex;
	});

	const totalSets = $derived(flatSets.length);
	const completedSets = $derived(flatSets.filter(s => s.completed).length);

	function handleSetClick(flatSet: FlatSet) {
		if (onSetClick) {
			onSetClick(flatSet.exerciseIndex, flatSet.setIndex);
		}
	}

	function getSetStatus(flatSet: FlatSet, idx: number): 'completed' | 'current' | 'pending' {
		if (flatSet.completed) return 'completed';
		if (idx === currentFlatIndex) return 'current';
		return 'pending';
	}
</script>

<div class="bg-surface-elevated border-b border-border px-3 py-3 sm:px-4 sm:py-4">
	<!-- Tappable Set-Level Progress Bar - Fixed height container to prevent jitter -->
	<div class="flex gap-1 mb-2 items-end h-8" role="navigation" aria-label="Workout progress">
		{#each flatSets as flatSet, idx (idx)}
			{@const status = getSetStatus(flatSet, idx)}
			<button
				type="button"
				onclick={() => handleSetClick(flatSet)}
				class="flex-1 rounded transition-all duration-200 min-w-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-elevated
					{status === 'current'
						? 'h-8 bg-accent shadow-[0_0_12px_rgba(197,255,0,0.6)] hover:bg-accent-muted'
						: status === 'completed'
							? 'h-5 bg-success hover:bg-success-muted'
							: 'h-5 bg-surface-hover border border-border hover:bg-surface hover:border-border-active'}"
				aria-label="{flatSet.exerciseName} Set {flatSet.setIndex + 1} - {status}"
				aria-current={status === 'current' ? 'step' : undefined}
			></button>
		{/each}
	</div>

	<!-- Exercise Label -->
	<div class="flex items-center justify-between text-sm">
		<span class="text-text-secondary">
			Set {currentFlatIndex + 1} of {totalSets}
			<span class="text-text-muted ml-1">({completedSets} done)</span>
		</span>
		<span class="text-text-primary font-medium truncate ml-2 max-w-[60%] text-right">
			{currentExerciseName}
		</span>
	</div>
</div>
