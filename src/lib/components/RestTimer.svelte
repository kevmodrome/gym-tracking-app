<script lang="ts">
	import { Timer } from '$lib/timer.svelte';

	let { duration = 90, onComplete, onSkip, compact = false } = $props<{
		duration?: number;
		onComplete?: () => void;
		onSkip?: () => void;
		compact?: boolean;
	}>();

	const timer = new Timer(duration, () => onComplete);

	$effect(() => {
		timer.setDuration(duration);
	});

	const circumference = $derived(2 * Math.PI * 54);
	const offset = $derived(circumference - (timer.progressPercent / 100) * circumference);

	// Compact mode uses a smaller circle
	const compactCircumference = $derived(2 * Math.PI * 36);
	const compactOffset = $derived(compactCircumference - (timer.progressPercent / 100) * compactCircumference);

	$effect(() => {
		return () => timer.destroy();
	});
</script>

{#if compact}
	<!-- Compact Mode -->
	<div class="flex flex-col items-center">
		<div class="relative inline-block mb-3">
			<svg class="w-24 h-24 transform -rotate-90">
				<circle
					cx="48"
					cy="48"
					r="36"
					stroke="#2a2b32"
					stroke-width="6"
					fill="none"
				/>
				<circle
					cx="48"
					cy="48"
					r="36"
					stroke="#c5ff00"
					stroke-width="6"
					fill="none"
					stroke-linecap="round"
					stroke-dasharray={compactCircumference}
					stroke-dashoffset={compactOffset}
					class="drop-shadow-[0_0_8px_rgba(197,255,0,0.5)]"
				/>
			</svg>
			<div class="absolute inset-0 flex items-center justify-center">
				<span class="text-2xl font-display font-bold text-text-primary">{timer.formattedTime}</span>
			</div>
		</div>

		<!-- Compact Controls -->
		<div class="flex items-center gap-2 mb-3">
			<button
				onclick={() => timer.adjustDuration(-30)}
				disabled={timer.isRunning}
				class="px-3 py-1.5 text-sm bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors disabled:opacity-50"
				type="button"
			>
				-30s
			</button>
			{#if !timer.isRunning && !timer.isPaused}
				<button
					onclick={() => timer.start()}
					class="px-4 py-1.5 text-sm bg-accent text-bg rounded-lg hover:bg-accent-muted transition-colors font-medium"
					type="button"
				>
					Start
				</button>
			{:else if timer.isRunning}
				<button
					onclick={() => timer.pause()}
					class="px-4 py-1.5 text-sm bg-warning text-bg rounded-lg hover:opacity-90 transition-colors font-medium"
					type="button"
				>
					Pause
				</button>
			{:else}
				<button
					onclick={() => timer.resume()}
					class="px-4 py-1.5 text-sm bg-success text-bg rounded-lg hover:opacity-90 transition-colors font-medium"
					type="button"
				>
					Resume
				</button>
			{/if}
			<button
				onclick={() => timer.adjustDuration(30)}
				disabled={timer.isRunning}
				class="px-3 py-1.5 text-sm bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors disabled:opacity-50"
				type="button"
			>
				+30s
			</button>
		</div>

		<button
			onclick={() => timer.skip(onSkip)}
			class="w-full px-4 py-2.5 bg-surface-elevated border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors font-medium"
			type="button"
		>
			Skip Rest
		</button>
	</div>
{:else}
	<!-- Full Mode -->
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
					<span class="text-4xl font-display font-bold text-text-primary">{timer.formattedTime}</span>
				</div>
			</div>

			<div class="flex items-center justify-center gap-2 mb-4">
				<label for="duration-input" class="text-sm text-text-secondary">Duration (s):</label>
				<input
					id="duration-input"
					type="number"
					min="10"
					max="300"
					value={timer.timeLeft}
					onchange={(e) => { timer.timeLeft = Number((e.target as HTMLInputElement).value); }}
					disabled={timer.isRunning}
					class="w-20 px-2 py-1 bg-surface-elevated border border-border rounded text-center text-text-primary focus:ring-2 focus:ring-accent disabled:opacity-50"
				/>
			</div>
		</div>

		<div class="flex gap-3">
			{#if !timer.isRunning && !timer.isPaused}
				<button
					onclick={() => timer.start()}
					class="flex-1 px-4 py-3 bg-accent text-bg rounded-lg hover:bg-accent-muted hover:shadow-[0_0_20px_rgba(197,255,0,0.3)] transition-all font-medium flex items-center justify-center gap-2"
					type="button"
				>
					<span class="text-xl">▶</span>
					Start
				</button>
			{:else if timer.isRunning}
				<button
					onclick={() => timer.pause()}
					class="flex-1 px-4 py-3 bg-warning text-bg rounded-lg hover:opacity-90 transition-colors font-medium flex items-center justify-center gap-2"
					type="button"
				>
					<span class="text-xl">⏸</span>
					Pause
				</button>
			{:else}
				<button
					onclick={() => timer.resume()}
					class="flex-1 px-4 py-3 bg-success text-bg rounded-lg hover:opacity-90 transition-colors font-medium flex items-center justify-center gap-2"
					type="button"
				>
					<span class="text-xl">▶</span>
					Resume
				</button>
			{/if}

			<button
				onclick={() => timer.skip(onSkip)}
				class="flex-1 px-4 py-3 bg-surface-elevated border border-border text-text-secondary rounded-lg hover:bg-surface hover:text-text-primary transition-colors font-medium flex items-center justify-center gap-2"
				type="button"
			>
				<span class="text-xl">⏭</span>
				Skip
			</button>

			<button
				onclick={() => timer.reset()}
				class="w-16 px-4 py-3 bg-danger text-white rounded-lg hover:opacity-90 transition-colors flex items-center justify-center"
				type="button"
				title="Reset"
			>
				<span class="text-xl">↻</span>
			</button>
		</div>
	</div>
{/if}
