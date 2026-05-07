<script lang="ts">
	import type { SessionExercise } from '$lib/types';

	interface WorkoutProgressBarProps {
		exercises: SessionExercise[];
		currentExerciseIndex: number;
		currentSetIndex: number;
		currentExerciseName: string;
		onSetClick?: (exerciseIndex: number, setIndex: number) => void;
		onExerciseClick?: (exerciseIndex: number) => void;
	}

	let {
		exercises,
		currentExerciseIndex,
		currentSetIndex,
		currentExerciseName,
		onSetClick,
		onExerciseClick
	}: WorkoutProgressBarProps = $props();

	type SetStatus = 'completed' | 'current' | 'pending';

	function getSetStatus(
		exIdx: number,
		setIdx: number,
		completed: boolean
	): SetStatus {
		if (exIdx === currentExerciseIndex && setIdx === currentSetIndex) return 'current';
		if (completed) return 'completed';
		return 'pending';
	}

	function getExerciseStatus(
		exIdx: number,
		exercise: SessionExercise
	): SetStatus {
		if (exIdx === currentExerciseIndex) return 'current';
		const allDone = exercise.sets.length > 0 && exercise.sets.every((s) => s.completed);
		if (allDone) return 'completed';
		return 'pending';
	}

	const currentExercise = $derived(exercises[currentExerciseIndex] ?? null);
	const totalSetsInExercise = $derived(currentExercise?.sets.length ?? 0);
	const completedSetsInExercise = $derived(
		currentExercise ? currentExercise.sets.filter((s) => s.completed).length : 0
	);

	function handleExerciseClick(idx: number) {
		if (onExerciseClick) {
			onExerciseClick(idx);
		} else if (onSetClick) {
			onSetClick(idx, 0);
		}
	}

	function handleSetClick(exIdx: number, setIdx: number) {
		onSetClick?.(exIdx, setIdx);
	}
</script>

<div class="bg-surface-elevated border-b border-border px-3 py-2.5 sm:px-4">
	<!-- Exercise strip -->
	{#if exercises.length > 1}
		<div
			class="flex items-center gap-1.5 mb-2 overflow-x-auto -mx-1 px-1"
			role="tablist"
			aria-label="Exercises"
		>
			{#each exercises as exercise, exIdx (exIdx)}
				{@const status = getExerciseStatus(exIdx, exercise)}
				<button
					type="button"
					role="tab"
					aria-selected={status === 'current'}
					onclick={() => handleExerciseClick(exIdx)}
					class="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
						{status === 'current'
							? 'bg-surface border-border-active text-text-primary'
							: status === 'completed'
								? 'bg-transparent border-success/40 text-success hover:bg-success/10'
								: 'bg-transparent border-border text-text-muted hover:text-text-secondary'}"
				>
					<span
						class="block w-1.5 h-1.5 rounded-full
							{status === 'current'
								? 'bg-text-primary'
								: status === 'completed'
									? 'bg-success'
									: 'bg-text-muted'}"
					></span>
					<span class="truncate max-w-[8rem]">{exercise.exerciseName}</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- Set-status dots for the CURRENT exercise -->
	{#if currentExercise}
		<div
			class="flex items-center gap-1.5 mb-1.5"
			role="navigation"
			aria-label="Sets in {currentExerciseName}"
		>
			{#each currentExercise.sets as set, setIdx (setIdx)}
				{@const status = getSetStatus(currentExerciseIndex, setIdx, set.completed)}
				{@const isWarmup = !!set.warmup}
				<button
					type="button"
					onclick={() => handleSetClick(currentExerciseIndex, setIdx)}
					aria-label="Set {setIdx + 1} - {status}{isWarmup ? ' (warmup)' : ''}"
					aria-current={status === 'current' ? 'step' : undefined}
					class="group relative inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					<span
						class="block w-3.5 h-3.5 rounded-full transition-all
							{status === 'completed'
								? 'bg-success'
								: status === 'current'
									? 'bg-transparent ring-2 ring-text-primary'
									: 'bg-surface ring-1 ring-border'}
							{isWarmup ? 'opacity-60' : ''}"
					></span>
				</button>
			{/each}
		</div>

		<div class="flex items-center justify-between text-xs">
			<span class="text-text-muted">
				Set {currentSetIndex + 1} of {totalSetsInExercise}
				<span class="ml-1 text-text-muted">({completedSetsInExercise} done)</span>
			</span>
			<span class="text-text-primary font-medium truncate ml-2 max-w-[60%] text-right">
				{currentExerciseName}
			</span>
		</div>
	{/if}
</div>