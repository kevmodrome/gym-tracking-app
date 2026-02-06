<script lang="ts">
	import { Button } from '$lib/ui';
	import { ArrowLeft } from 'lucide-svelte';
	import { preferencesStore } from '$lib/stores/preferences.svelte';

	interface TimerPageProps {
		duration: number;
		nextExerciseName: string;
		nextSetNumber: number;
		nextTotalSets: number;
		nextTargetReps: number;
		nextTargetWeight: number;
		lastCompletedReps?: number;
		lastCompletedWeight?: number;
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

	let timeLeft = $state(duration);
	let isRunning = $state(false);
	let isPaused = $state(false);
	let intervalId: number | null = null;

	$effect(() => {
		timeLeft = duration;
	});

	const formattedTime = $derived.by(() => {
		const minutes = Math.floor(timeLeft / 60);
		const seconds = timeLeft % 60;
		return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	});

	const progressPercent = $derived.by(() => {
		return ((duration - timeLeft) / duration) * 100;
	});

	// Smaller circle for mobile
	const radius = 54;
	const circumference = $derived(2 * Math.PI * radius);
	const offset = $derived(circumference - (progressPercent / 100) * circumference);

	function startTimer() {
		if (isRunning) return;
		isRunning = true;
		isPaused = false;

		intervalId = window.setInterval(() => {
			if (timeLeft > 0) {
				timeLeft--;
			} else {
				endTimer();
			}
		}, 1000);
	}

	function pauseTimer() {
		if (!isRunning) return;
		isRunning = false;
		isPaused = true;

		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function resumeTimer() {
		if (!isPaused) return;
		startTimer();
	}

	function endTimer() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}

		playSound();
		vibrate();
		onComplete();
	}

	function skipTimer() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		isRunning = false;
		isPaused = false;
		onSkip();
	}

	function adjustDuration(amount: number) {
		const newDuration = Math.max(10, Math.min(300, timeLeft + amount));
		timeLeft = newDuration;
	}

	function playSound() {
		const saved = localStorage.getItem('gym-app-settings');
		const settings = saved ? JSON.parse(saved) : { soundEnabled: true };

		if (settings.soundEnabled) {
			const audio = new Audio('/alarm.mp3');
			audio.play().catch((err) => {
				console.log('Audio play failed:', err);
			});
		}
	}

	function vibrate() {
		const saved = localStorage.getItem('gym-app-settings');
		const settings = saved ? JSON.parse(saved) : { vibrationEnabled: true };

		if (settings.vibrationEnabled && 'vibrate' in navigator) {
			navigator.vibrate([200, 100, 200, 100, 200]);
		}
	}

	$effect(() => {
		return () => {
			if (intervalId) {
				clearInterval(intervalId);
			}
		};
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
						<span class="text-lg">✓</span>
						<span class="font-semibold">Set {lastCompletedSetNumber} complete!</span>
					</div>
					{#if lastCompletedReps !== undefined && lastCompletedWeight !== undefined}
						<p class="text-sm text-text-secondary">
							{lastCompletedReps} reps @ {lastCompletedWeight} {preferencesStore.weightLabel}
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
					<span class="text-4xl sm:text-5xl font-display font-bold text-text-primary">{formattedTime}</span>
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

	<!-- Fixed Bottom Action Bar - Mobile -->
	<div class="fixed bottom-20 left-0 right-0 bg-surface border-t border-border p-4 md:hidden z-40">
		<div class="max-w-md mx-auto space-y-3">
			<!-- Timer Controls Row -->
			<div class="flex items-center justify-center gap-3">
				<button
					onclick={() => adjustDuration(-30)}
					disabled={isRunning}
					class="px-4 py-2.5 text-sm bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors disabled:opacity-50 min-h-[44px] min-w-[60px]"
					type="button"
				>
					-30s
				</button>

				{#if !isRunning && !isPaused}
					<Button variant="primary" size="lg" onclick={startTimer} class="px-8 min-w-[100px]">
						Start
					</Button>
				{:else if isRunning}
					<Button variant="secondary" size="lg" onclick={pauseTimer} class="px-8 min-w-[100px] bg-warning text-bg hover:bg-warning-muted">
						Pause
					</Button>
				{:else}
					<Button variant="success" size="lg" onclick={resumeTimer} class="px-8 min-w-[100px]">
						Resume
					</Button>
				{/if}

				<button
					onclick={() => adjustDuration(30)}
					disabled={isRunning}
					class="px-4 py-2.5 text-sm bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors disabled:opacity-50 min-h-[44px] min-w-[60px]"
					type="button"
				>
					+30s
				</button>
			</div>

			<!-- Skip Rest Button -->
			<Button
				variant="secondary"
				fullWidth
				onclick={skipTimer}
			>
				Skip Rest
			</Button>
		</div>
	</div>

	<!-- Desktop Action Buttons (inline) -->
	<div class="hidden md:block px-4 pb-6">
		<div class="max-w-md mx-auto space-y-3">
			<div class="flex items-center justify-center gap-3">
				<button
					onclick={() => adjustDuration(-30)}
					disabled={isRunning}
					class="px-4 py-2 text-sm bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors disabled:opacity-50 min-h-[44px]"
					type="button"
				>
					-30s
				</button>

				{#if !isRunning && !isPaused}
					<Button variant="primary" size="lg" onclick={startTimer} class="px-8">
						Start
					</Button>
				{:else if isRunning}
					<Button variant="secondary" size="lg" onclick={pauseTimer} class="px-8 bg-warning text-bg hover:bg-warning-muted">
						Pause
					</Button>
				{:else}
					<Button variant="success" size="lg" onclick={resumeTimer} class="px-8">
						Resume
					</Button>
				{/if}

				<button
					onclick={() => adjustDuration(30)}
					disabled={isRunning}
					class="px-4 py-2 text-sm bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors disabled:opacity-50 min-h-[44px]"
					type="button"
				>
					+30s
				</button>
			</div>

			<Button
				variant="secondary"
				fullWidth
				size="lg"
				onclick={skipTimer}
			>
				Skip Rest
			</Button>
		</div>
	</div>
</div>
