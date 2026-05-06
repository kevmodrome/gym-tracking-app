<script lang="ts">
	import { Button } from '$lib/ui';
	import { ChevronUp, X } from 'lucide-svelte';
	import { Timer } from '$lib/timer.svelte';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import type { SetWeight } from '$lib/types';
	import { formatSetWeight } from '$lib/formatUtils';

	type TimerMode = 'compact' | 'expanded';

	interface TimerPageProps {
		duration: number;
		mode?: TimerMode;
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
		onExpand?: () => void;
		onCollapse?: () => void;
	}

	let {
		duration = 90,
		mode = 'compact',
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
		onExpand,
		onCollapse
	}: TimerPageProps = $props();

	// Initial duration via factory function avoids state_referenced_locally warning.
	const initialDuration = (() => duration)();
	const timer = new Timer(initialDuration, () => onComplete);

	// Auto-start the timer when this component mounts (timer is meant to begin
	// immediately when the user taps Skip+Rest / completes a set).
	$effect(() => {
		if (!timer.isRunning && !timer.isPaused && timer.timeLeft > 0) {
			timer.start();
		}
	});

	// Keep duration in sync if the prop ever changes (e.g., per-exercise default)
	$effect(() => {
		// Only re-set duration if timer hasn't started yet (avoid wiping mid-rest).
		if (!timer.isRunning && !timer.isPaused) {
			timer.setDuration(duration);
		}
	});

	const radius = 54;
	const circumference = $derived(2 * Math.PI * radius);
	const offset = $derived(circumference - (timer.progressPercent / 100) * circumference);

	$effect(() => {
		return () => timer.destroy();
	});

	function handleExpand() {
		onExpand?.();
	}

	function handleCollapse() {
		onCollapse?.();
	}

	const lastSummary = $derived.by(() => {
		if (lastCompletedSetNumber === undefined) return '';
		if (lastCompletedReps === undefined || lastCompletedWeight === undefined) {
			return `Set ${lastCompletedSetNumber} done`;
		}
		return `Last: ${lastCompletedReps} × ${formatSetWeight(lastCompletedWeight)}`;
	});
</script>

{#if mode === 'compact'}
	<!-- Sticky-bar mode: non-blocking, sits above the bottom nav. -->
	<button
		type="button"
		onclick={handleExpand}
		aria-label="Expand rest timer"
		class="timer-sticky-bar fixed left-0 right-0 z-40 bg-surface-elevated border-t border-border-active text-left flex items-center gap-3 px-4 py-2.5 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.4)] hover:bg-surface-hover transition-colors"
		style="bottom: calc(4rem + env(safe-area-inset-bottom));"
	>
		<!-- Countdown number -->
		<span
			class="font-display font-bold tabular-nums text-2xl text-text-primary min-w-[60px]"
		>
			{timer.formattedTime}
		</span>

		<!-- Middle: progress strip + last summary -->
		<div class="flex-1 min-w-0">
			{#if lastSummary}
				<p class="text-xs text-text-secondary truncate">{lastSummary}</p>
			{:else}
				<p class="text-xs text-text-secondary truncate">Resting…</p>
			{/if}
			<div class="mt-1 h-1 w-full bg-surface rounded-full overflow-hidden">
				<div
					class="h-full bg-text-secondary timer-progress-strip"
					style="width: {timer.progressPercent}%;"
				></div>
			</div>
		</div>

		<!-- Tap to expand affordance -->
		<span class="flex-shrink-0 text-text-secondary">
			<ChevronUp class="w-5 h-5" />
		</span>
	</button>
{:else}
	<!-- Expanded "zen" mode: full-screen overlay -->
	<div
		class="timer-expanded fixed inset-0 z-50 bg-bg flex flex-col"
		role="dialog"
		aria-modal="true"
		aria-label="Rest timer"
	>
		<!-- Header with close -->
		<div class="flex items-center justify-between px-4 py-3 border-b border-border">
			<button
				type="button"
				onclick={handleCollapse}
				aria-label="Collapse rest timer"
				class="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors min-h-[44px] min-w-[44px]"
			>
				<X class="w-5 h-5" />
				<span class="hidden sm:inline">Close</span>
			</button>
			<h2 class="text-base font-medium text-text-secondary">Rest</h2>
			<div class="w-[44px]"></div>
		</div>

		<!-- Scrollable content -->
		<div class="flex-1 overflow-y-auto px-4 pb-44 md:pb-6">
			<div class="flex flex-col items-center pt-6">
				<!-- Last completed set summary -->
				{#if lastCompletedSetNumber !== undefined}
					<div class="mb-4 text-center">
						<p class="text-sm text-text-secondary">
							Set {lastCompletedSetNumber} complete
							{#if lastCompletedReps !== undefined && lastCompletedWeight !== undefined}
								· {lastCompletedReps} reps @ {formatSetWeight(lastCompletedWeight)}
							{/if}
						</p>
					</div>
				{/if}

				<!-- Circular timer -->
				<div class="relative mb-6">
					<svg class="w-40 h-40 sm:w-48 sm:h-48 transform -rotate-90">
						<circle
							cx="50%"
							cy="50%"
							r={radius}
							stroke="currentColor"
							stroke-width="6"
							fill="none"
							class="text-surface-elevated"
						/>
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
							class="text-text-primary timer-progress-circle"
						/>
					</svg>
					<div class="absolute inset-0 flex items-center justify-center">
						<span class="text-4xl sm:text-5xl font-display font-bold tabular-nums text-text-primary">
							{timer.formattedTime}
						</span>
					</div>
				</div>

				<!-- Next preview -->
				<div
					class="bg-surface-elevated border border-border rounded-lg px-4 py-3 text-center"
				>
					<p class="text-text-secondary text-sm">
						Next:
						<span class="text-text-primary font-medium">{nextExerciseName}</span>
						· Set {nextSetNumber} of {nextTotalSets}
					</p>
					<p class="text-text-muted text-xs mt-1">
						{nextTargetReps} reps @ {formatSetWeight(nextTargetWeight)}
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
					<Button
						variant="secondary"
						size="lg"
						onclick={() => timer.start()}
						class="px-8 min-w-[100px]"
					>
						Start
					</Button>
				{:else if timer.isRunning}
					<Button
						variant="secondary"
						size="lg"
						onclick={() => timer.pause()}
						class="px-8 min-w-[100px]"
					>
						Pause
					</Button>
				{:else}
					<Button
						variant="secondary"
						size="lg"
						onclick={() => timer.resume()}
						class="px-8 min-w-[100px]"
					>
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

			<Button variant="secondary" fullWidth size="lg" onclick={() => timer.skip(onSkip)}>
				Skip Rest
			</Button>
		</ActionBar>
	</div>
{/if}

<style>
	.timer-sticky-bar {
		animation: timer-bar-slide-up 180ms ease-out;
	}
	.timer-expanded {
		animation: timer-fade-in 160ms ease-out;
	}
	.timer-progress-strip {
		transition: width 1s linear;
	}
	.timer-progress-circle {
		transition: stroke-dashoffset 1s linear;
	}

	@keyframes timer-bar-slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	@keyframes timer-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.timer-sticky-bar,
		.timer-expanded {
			animation: none;
		}
		.timer-progress-strip,
		.timer-progress-circle {
			transition: none;
		}
	}
</style>
