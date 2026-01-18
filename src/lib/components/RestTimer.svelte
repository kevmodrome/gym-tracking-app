<script lang="ts">
	let { duration = 90, onComplete, onSkip } = $props<{
		duration?: number;
		onComplete?: () => void;
		onSkip?: () => void;
	}>();

	let timeLeft = $state(0);
	let isRunning = $state(false);
	let isPaused = $state(false);
	let intervalId: number | null = null;
	let customDuration = $state(0);

	$effect(() => {
		timeLeft = duration;
		customDuration = duration;
	});

	const formattedTime = $derived.by(() => {
		const minutes = Math.floor(timeLeft / 60);
		const seconds = timeLeft % 60;
		return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	});

	const progressPercent = $derived.by(() => {
		return ((duration - timeLeft) / duration) * 100;
	});

	const circumference = $derived.by(() => 2 * Math.PI * 54);
	const offset = $derived.by(() => circumference - (progressPercent / 100) * circumference);

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

	function skipTimer() {
		resetTimer();
		if (onSkip) {
			onSkip();
		}
	}

	function endTimer() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}

		playSound();
		vibrate();

		if (onComplete) {
			onComplete();
		}
	}

	function resetTimer() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		timeLeft = duration;
		isRunning = false;
		isPaused = false;
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

	function updateCustomDuration() {
		timeLeft = customDuration;
	}

	$effect(() => {
		return () => {
			if (intervalId) {
				clearInterval(intervalId);
			}
		};
	});
</script>

<div class="bg-surface border border-border rounded-xl shadow-lg p-6 w-full max-w-md mx-auto">
	<div class="text-center mb-6">
		<h3 class="text-lg font-semibold text-text-primary mb-2">Rest Timer</h3>

		<div class="relative inline-block mb-4">
			<svg class="w-36 h-36 transform -rotate-90">
				<circle
					cx="72"
					cy="72"
					r="54"
					stroke="#2a2b32"
					stroke-width="8"
					fill="none"
				/>
				<circle
					cx="72"
					cy="72"
					r="54"
					stroke="#c5ff00"
					stroke-width="8"
					fill="none"
					stroke-linecap="round"
					stroke-dasharray={circumference}
					stroke-dashoffset={offset}
					class="drop-shadow-[0_0_10px_rgba(197,255,0,0.5)]"
				/>
			</svg>
			<div class="absolute inset-0 flex items-center justify-center">
				<span class="text-4xl font-display font-bold text-text-primary">{formattedTime}</span>
			</div>
		</div>

		<div class="flex items-center justify-center gap-2 mb-4">
			<label for="duration-input" class="text-sm text-text-secondary">Duration (s):</label>
			<input
				id="duration-input"
				type="number"
				min="10"
				max="300"
				bind:value={customDuration}
				onchange={updateCustomDuration}
				disabled={isRunning}
				class="w-20 px-2 py-1 bg-surface-elevated border border-border rounded text-center text-text-primary focus:ring-2 focus:ring-accent disabled:opacity-50"
			/>
		</div>
	</div>

	<div class="flex gap-3">
		{#if !isRunning && !isPaused}
			<button
				onclick={startTimer}
				class="flex-1 px-4 py-3 bg-accent text-bg rounded-lg hover:bg-accent-muted hover:shadow-[0_0_20px_rgba(197,255,0,0.3)] transition-all font-medium flex items-center justify-center gap-2"
				type="button"
			>
				<span class="text-xl">▶</span>
				Start
			</button>
		{:else if isRunning}
			<button
				onclick={pauseTimer}
				class="flex-1 px-4 py-3 bg-warning text-bg rounded-lg hover:opacity-90 transition-colors font-medium flex items-center justify-center gap-2"
				type="button"
			>
				<span class="text-xl">⏸</span>
				Pause
			</button>
		{:else}
			<button
				onclick={resumeTimer}
				class="flex-1 px-4 py-3 bg-success text-bg rounded-lg hover:opacity-90 transition-colors font-medium flex items-center justify-center gap-2"
				type="button"
			>
				<span class="text-xl">▶</span>
				Resume
			</button>
		{/if}

		<button
			onclick={skipTimer}
			class="flex-1 px-4 py-3 bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors font-medium flex items-center justify-center gap-2"
			type="button"
		>
			<span class="text-xl">⏭</span>
			Skip
		</button>

		<button
			onclick={resetTimer}
			class="w-16 px-4 py-3 bg-danger text-white rounded-lg hover:opacity-90 transition-colors flex items-center justify-center"
			type="button"
			title="Reset"
		>
			<span class="text-xl">↻</span>
		</button>
	</div>
</div>
