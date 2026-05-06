<script lang="ts">
	import type { SessionExercise, ExerciseSet } from '$lib/types';
	import { NumberSpinner, Button } from '$lib/ui';
	import { Timer, Check } from 'lucide-svelte';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import ActionBar from '$lib/components/ActionBar.svelte';

	interface SetPageProps {
		exercise: SessionExercise;
		setIndex: number;
		onComplete: () => void;
		onSkip: () => void;
		onStartTimer: () => void;
		onOpenMenu: () => void;
		onSetChange: () => void;
	}

	let {
		exercise,
		setIndex,
		onComplete,
		onSkip,
		onStartTimer,
		onOpenMenu,
		onSetChange
	}: SetPageProps = $props();

	const currentSet = $derived(exercise.sets[setIndex]);
	const totalSets = $derived(exercise.sets.length);
</script>

<div class="flex flex-col h-full">
	<!-- Scrollable Content Area -->
	<div class="flex-1 overflow-y-auto px-4 py-6 pb-48 md:pb-6">
		<div class="flex flex-col items-center justify-center min-h-full">
			<!-- Exercise Name -->
			<h1 class="text-2xl sm:text-3xl font-bold font-display text-text-primary text-center mb-2">
				{exercise.exerciseName}
			</h1>

			<!-- Set Indicator -->
			<p class="text-lg text-text-secondary mb-8">
				Set {setIndex + 1} of {totalSets}
			</p>

			<!-- Reps and Weight Inputs -->
			{#if currentSet}
				<div class="w-full max-w-md grid grid-cols-2 gap-4 mb-8">
					<NumberSpinner
						label="Reps"
						bind:value={currentSet.reps}
						min={0}
						step={1}
						size="lg"
						onchange={onSetChange}
					/>
					<NumberSpinner
						label="Weight ({preferencesStore.weightLabel})"
						bind:value={currentSet.weight}
						min={0}
						step={5}
						size="lg"
						onchange={onSetChange}
					/>
				</div>
			{/if}

			<!-- Completed indicator if set was already done -->
			{#if currentSet?.completed}
				<div class="flex items-center gap-2 text-success mb-4">
					<Check class="w-5 h-5" />
					<span class="font-medium">Set completed</span>
				</div>
			{/if}
		</div>
	</div>

	<ActionBar>
		<Button
			variant="primary"
			fullWidth
			size="lg"
			onclick={onStartTimer}
		>
			<Timer class="w-5 h-5" />
			Start Timer
		</Button>
		<div class="grid grid-cols-2 gap-3">
			<Button
				variant="success"
				fullWidth
				size="lg"
				onclick={onComplete}
			>
				<Check class="w-5 h-5" /> Complete
			</Button>
			<Button
				variant="secondary"
				fullWidth
				size="lg"
				onclick={onSkip}
			>
				Skip
			</Button>
		</div>
	</ActionBar>
</div>
