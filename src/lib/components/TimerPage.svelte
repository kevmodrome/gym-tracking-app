<script lang="ts">
	import { Button } from '$lib/ui';
	import { ArrowLeft, Check } from 'lucide-svelte';
	import { Timer } from '$lib/timer.svelte';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import type { SetWeight } from '$lib/types';
	import { formatSetWeight } from '$lib/formatUtils';

	interface TimerPageProps {
		duration: number;
		nextExerciseName: string;
		nextSetNumber: number;
		nextTotalSets: number;
		nextTargetReps: number;
		nextTargetWeight: SetWeight;
		lastCompletedReps?: number;
		lastCompletedWeight?: SetWeight;
		lastCompletedSetNumber?: number;
		onComplete: () => void;
		onSkip: () => void;
		onBack: () => void;
	}

	let {
		duration = 90,
		nextExerciseName,
		nextSetNumber,
		nextTotalSets,
		nextTargetReps,
		nextTargetWeight,
		lastCompletedReps,
		lastCompletedWeight,
		lastCompletedSetNumber,
		onComplete,
		onSkip,
		onBack
	}: TimerPageProps = $props();

	const timer = new Timer(duration, () => onComplete);

	$effect(() => {
		timer.setDuration(duration);
	});

	const radius = 54;
	const circumference = $derived(2 * Math.PI * radius);
	const offset = $derived(circumference - (timer.progressPercent / 100) * circumference);

	$effect(() => {
		return () => timer.destroy();
	});
</script>

<div class="flex flex-col h-full">
	<!-- Scrollable Content Area -->
	<div class="flex-1 overflow-y-auto px-4 pb-44 md:pb-6">
		<!-- Back Button -->
		<div class="pt-2 pb-4">
			<button
				onclick={onBack}
				class="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors min-h-[44px]"
				type="button"
			>
				<ArrowLeft class="w-5 h-5" />
				<span>Back to Set</span>
			</button>
		</div>

		<!-- Main Content - Centered -->
		<div class="flex flex-col items-center">
			<!-- Completed Set Info -->
			{#if lastCompletedSetNumber !== undefined}
				<div class="mb-4 text-center">
					<div class="flex items-center justify-center gap-2 text-success mb-1">
						<Check class="w-5 h-5" />
						<span class="font-semibold">Set {lastCompletedSetNumber} complete!</span>
					</div>
					{#if lastCompletedReps !== undefined && lastCompletedWeight !== undefined}
						<p class="text-sm text-text-secondary">
							{lastCompletedReps} reps @ {formatSetWeight(lastCompletedWeight)}
						</p>
					{/if}
				</div>
			{/if}

			<!-- Timer Circle - Smaller for mobile -->
			<div class="relative mb-6">
				<svg class="w-32 h-32 sm:w-40 sm:h-40 transform -rotate-90">
					<!-- Background circle -->
					<circle
						cx="50%"
						cy="50%"
						r={radius}
						stroke="currentColor"
						stroke-width="6"
						fill="none"
						class="text-surface-elevated"
					/>
					<!-- Progress circle -->
					<circle
						cx="50%"
						cy="50%"
						r={radius}
						stroke="currentColor"
						stroke-width="6"
						fill="none"
						stroke-linecap="round"
						stroke-dasharray={circumference}
						stroke-dashoffset={offset}
						class="text-accent drop-shadow-[0_0_8px_rgba(197,255,0,0.5)] transition-all duration-1000"
					/>
				</svg>
				<div class="absolute inset-0 flex items-center justify-center">
					<span class="text-4xl sm:text-5xl font-display font-bold text-text-primary">{timer.formattedTime}</span>
				</div>
			</div>

			<!-- Simple "Next" Card -->
			<div class="bg-surface-elevated border border-border rounded-lg px-4 py-3 text-center">
				<p class="text-text-secondary text-sm">
					Next: <span class="text-text-primary font-medium">{nextExerciseName}</span>
				</p>
			</div>
		</div>
	</div>

	<ActionBar>
		<div class="flex items-center justify-center gap-3">
			<button
				onclick={() => timer.adjustDuration(-30)}
				disabled={timer.isRunning}
				class="px-4 py-2.5 text-sm bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors disabled:opacity-50 min-h-[44px] min-w-[60px]"
				type="button"
			>
				-30s
			</button>

			{#if !timer.isRunning && !timer.isPaused}
				<Button variant="primary" size="lg" onclick={() => timer.start()} class="px-8 min-w-[100px]">
					Start
				</Button>
			{:else if timer.isRunning}
				<Button variant="secondary" size="lg" onclick={() => timer.pause()} class="px-8 min-w-[100px] bg-warning text-bg hover:bg-warning-muted">
					Pause
				</Button>
			{:else}
				<Button variant="success" size="lg" onclick={() => timer.resume()} class="px-8 min-w-[100px]">
					Resume
				</Button>
			{/if}

			<button
				onclick={() => timer.adjustDuration(30)}
				disabled={timer.isRunning}
				class="px-4 py-2.5 text-sm bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors disabled:opacity-50 min-h-[44px] min-w-[60px]"
				type="button"
			>
				+30s
			</button>
		</div>

		<Button
			variant="secondary"
			fullWidth
			size="lg"
			onclick={() => timer.skip(onSkip)}
		>
			Skip Rest
		</Button>
	</ActionBar>
</div>
