<script lang="ts">
	import type { SessionExercise } from '$lib/types';

	let {
		exercises,
		currentIndex,
		currentExerciseName
	} = $props<{
		exercises: SessionExercise[];
		currentIndex: number;
		currentExerciseName: string;
	}>();

	const getExerciseProgress = (exercise: SessionExercise): number => {
		if (exercise.sets.length === 0) return 0;
		const completedSets = exercise.sets.filter((s) => s.completed).length;
		return (completedSets / exercise.sets.length) * 100;
	};

	const isExerciseComplete = (exercise: SessionExercise): boolean => {
		return exercise.sets.length > 0 && exercise.sets.every((s) => s.completed);
	};
</script>

<div class="bg-surface-elevated border-b border-border px-3 py-2 sm:px-4 sm:py-3">
	<!-- Segmented Progress Bar -->
	<div class="flex gap-1 mb-2">
		{#each exercises as exercise, idx (exercise.exerciseId)}
			{@const progress = getExerciseProgress(exercise)}
			{@const isComplete = isExerciseComplete(exercise)}
			{@const isCurrent = idx === currentIndex}
			{@const isPast = idx < currentIndex}
			<div
				class="h-2 flex-1 rounded-full overflow-hidden transition-colors {isComplete
					? 'bg-success'
					: isCurrent || isPast
						? 'bg-surface-hover'
						: 'bg-surface-hover border border-border'}"
			>
				{#if !isComplete && (isCurrent || isPast) && progress > 0}
					<div
						class="h-full rounded-full transition-all duration-300 {isCurrent ? 'bg-accent' : 'bg-success'}"
						style="width: {progress}%"
					></div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Exercise Label -->
	<div class="flex items-center justify-between text-sm">
		<span class="text-text-secondary">
			Exercise {currentIndex + 1} of {exercises.length}
		</span>
		<span class="text-text-primary font-medium truncate ml-2 max-w-[60%] text-right">
			{currentExerciseName}
		</span>
	</div>
</div>
