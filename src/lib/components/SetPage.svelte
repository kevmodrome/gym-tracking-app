<script lang="ts">
	import type { SessionExercise } from '$lib/types';
	import { Button, Textarea } from '$lib/ui';
	import { Timer, Check, StickyNote, Flame, Gauge } from 'lucide-svelte';
	import { preferencesStore } from '$lib/stores/preferences.svelte';

	interface SetPageProps {
		exercise: SessionExercise;
		setIndex: number;
		onComplete: () => void;
		onSkip: () => void;
		onStartTimer: () => void;
		onSetChange: () => void;
		onFinishWorkout: () => void;
	}

	let {
		exercise,
		setIndex,
		onComplete,
		onSkip,
		onStartTimer,
		onSetChange,
		onFinishWorkout
	}: SetPageProps = $props();

	const currentSet = $derived(exercise.sets[setIndex]);
	const totalSets = $derived(exercise.sets.length);

	// Inline expansion state
	let rpeOpen = $state(false);
	let notesOpen = $state(false);

	// Local text input state, kept in sync with currentSet via $effect
	let repsText = $state('');
	let weightText = $state('');

	// Re-sync local input strings whenever the underlying set changes (e.g.,
	// navigating between sets). Avoids overwriting in-flight edits because
	// the effect fires only when setIndex / exercise identity changes.
	$effect(() => {
		// Track set identity
		void setIndex;
		void exercise;
		if (currentSet) {
			repsText = String(currentSet.reps ?? 0);
			weightText = currentSet.weight === 'BW' ? 'BW' : String(currentSet.weight ?? 0);
			// Auto-collapse inline panels when moving to a different set
			rpeOpen = false;
			notesOpen = false;
		}
	});

	function commitReps(raw: string) {
		if (!currentSet) return;
		const cleaned = raw.trim();
		if (cleaned === '') {
			currentSet.reps = 0;
		} else {
			const n = parseInt(cleaned, 10);
			currentSet.reps = Number.isFinite(n) && n >= 0 ? n : 0;
		}
		repsText = String(currentSet.reps);
		onSetChange();
	}

	function commitWeight(raw: string) {
		if (!currentSet) return;
		const cleaned = raw.trim();
		if (cleaned === '') {
			currentSet.weight = 0;
		} else if (/^bw$/i.test(cleaned)) {
			currentSet.weight = 'BW';
		} else {
			// Accept "187,5" too (some EU locales)
			const normalized = cleaned.replace(',', '.');
			const n = parseFloat(normalized);
			currentSet.weight = Number.isFinite(n) && n >= 0 ? n : 0;
		}
		weightText = currentSet.weight === 'BW' ? 'BW' : String(currentSet.weight);
		onSetChange();
	}

	function stepReps(delta: number) {
		if (!currentSet) return;
		const next = Math.max(0, (currentSet.reps ?? 0) + delta);
		currentSet.reps = next;
		repsText = String(next);
		onSetChange();
	}

	function stepWeight(delta: number) {
		if (!currentSet) return;
		const base =
			typeof currentSet.weight === 'number' && Number.isFinite(currentSet.weight)
				? currentSet.weight
				: 0;
		const next = Math.max(0, +(base + delta).toFixed(2));
		currentSet.weight = next;
		weightText = String(next);
		onSetChange();
	}

	function setRpe(value: number | undefined) {
		if (!currentSet) return;
		currentSet.rpe = value;
		onSetChange();
	}

	function toggleWarmup() {
		if (!currentSet) return;
		currentSet.warmup = !currentSet.warmup;
		onSetChange();
	}

	function setNotes(value: string) {
		if (!currentSet) return;
		currentSet.notes = value.length > 0 ? value : undefined;
		onSetChange();
	}

	const weightStep = 2.5;
</script>

<div class="flex flex-col h-full">
	<!-- Scrollable Content Area -->
	<div class="flex-1 overflow-y-auto px-4 pt-6 pb-4">
		<div class="max-w-md mx-auto w-full">
			<!-- Exercise Name -->
			<h1
				class="text-2xl sm:text-3xl font-bold font-display text-text-primary text-center mb-1
					{currentSet?.warmup ? 'opacity-70' : ''}"
			>
				{exercise.exerciseName}
			</h1>

			<!-- Set Indicator -->
			<p class="text-sm text-text-secondary text-center mb-5">
				Set {setIndex + 1} of {totalSets}
				{#if currentSet?.warmup}
					<span class="ml-1 text-text-muted">· warmup</span>
				{/if}
			</p>

			{#if currentSet}
				<!-- Reps + Weight (typeable + stepper) -->
				<div
					class="grid grid-cols-2 gap-3 mb-4 transition-opacity duration-150
						{currentSet.warmup ? 'opacity-60' : ''}"
				>
					<!-- Reps -->
					<div>
						<label
							for="set-reps-input"
							class="block text-xs font-medium text-text-secondary mb-1.5"
						>
							Reps
						</label>
						<div class="grid grid-cols-[auto_1fr_auto] rounded-lg overflow-hidden border border-border bg-surface-elevated">
							<button
								type="button"
								onclick={() => stepReps(-1)}
								class="px-3 py-3 text-text-primary font-bold hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px]"
								aria-label="Decrease reps"
							>
								−
							</button>
							<input
								id="set-reps-input"
								type="text"
								inputmode="numeric"
								pattern="[0-9]*"
								bind:value={repsText}
								onblur={() => commitReps(repsText)}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										(e.currentTarget as HTMLInputElement).blur();
									}
								}}
								class="w-full text-center font-bold font-display text-2xl bg-transparent text-text-primary focus:outline-none focus:bg-surface-hover py-3 min-h-[44px]"
								aria-label="Reps"
							/>
							<button
								type="button"
								onclick={() => stepReps(1)}
								class="px-3 py-3 text-text-primary font-bold hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px]"
								aria-label="Increase reps"
							>
								+
							</button>
						</div>
					</div>

					<!-- Weight -->
					<div>
						<label
							for="set-weight-input"
							class="block text-xs font-medium text-text-secondary mb-1.5"
						>
							Weight ({preferencesStore.weightLabel})
						</label>
						<div class="grid grid-cols-[auto_1fr_auto] rounded-lg overflow-hidden border border-border bg-surface-elevated">
							<button
								type="button"
								onclick={() => stepWeight(-weightStep)}
								class="px-3 py-3 text-text-primary font-bold hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px]"
								aria-label="Decrease weight"
							>
								−
							</button>
							<input
								id="set-weight-input"
								type="text"
								inputmode="decimal"
								bind:value={weightText}
								onblur={() => commitWeight(weightText)}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										(e.currentTarget as HTMLInputElement).blur();
									}
								}}
								class="w-full text-center font-bold font-display text-2xl bg-transparent text-text-primary focus:outline-none focus:bg-surface-hover py-3 min-h-[44px]"
								aria-label="Weight (type a number or BW)"
							/>
							<button
								type="button"
								onclick={() => stepWeight(weightStep)}
								class="px-3 py-3 text-text-primary font-bold hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px]"
								aria-label="Increase weight"
							>
								+
							</button>
						</div>
						<p class="mt-1 text-[11px] text-text-muted">Type a number or "BW"</p>
					</div>
				</div>

				<!-- Inline controls row: RPE / Notes / Warmup -->
				<div class="flex flex-wrap items-center gap-2 mb-4">
					<!-- RPE pill -->
					<button
						type="button"
						onclick={() => {
							rpeOpen = !rpeOpen;
							notesOpen = false;
						}}
						aria-expanded={rpeOpen}
						class="inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium border transition-colors
							{currentSet.rpe !== undefined
								? 'bg-surface-elevated border-border-active text-text-primary'
								: 'bg-surface-elevated border-border text-text-secondary hover:text-text-primary'}"
					>
						<Gauge class="w-4 h-4" />
						<span>RPE</span>
						<span
							class="font-display font-bold tabular-nums {currentSet.rpe !== undefined
								? 'text-text-primary'
								: 'text-text-muted'}"
						>
							{currentSet.rpe ?? '—'}
						</span>
					</button>

					<!-- Notes icon -->
					<button
						type="button"
						onclick={() => {
							notesOpen = !notesOpen;
							rpeOpen = false;
						}}
						aria-expanded={notesOpen}
						aria-label="Toggle note for this set"
						class="inline-flex items-center justify-center w-9 h-9 rounded-full border transition-colors
							{currentSet.notes
								? 'bg-surface-elevated border-border-active text-text-primary'
								: 'bg-surface-elevated border-border text-text-secondary hover:text-text-primary'}"
					>
						<StickyNote class="w-4 h-4" />
					</button>

					<!-- Warmup chip -->
					<button
						type="button"
						onclick={toggleWarmup}
						aria-pressed={!!currentSet.warmup}
						class="inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium border transition-colors
							{currentSet.warmup
								? 'bg-warning/15 border-warning/40 text-warning'
								: 'bg-surface-elevated border-border text-text-secondary hover:text-text-primary'}"
					>
						<Flame class="w-4 h-4" />
						<span>Warmup</span>
					</button>
				</div>

				<!-- Inline RPE scroller -->
				{#if rpeOpen}
					<div class="mb-4">
						<div class="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" role="radiogroup" aria-label="RPE">
							{#each Array.from({ length: 10 }, (_, i) => i + 1) as n}
								<button
									type="button"
									role="radio"
									aria-checked={currentSet.rpe === n}
									onclick={() => setRpe(currentSet.rpe === n ? undefined : n)}
									class="shrink-0 w-10 h-10 rounded-full text-sm font-bold font-display tabular-nums border transition-colors
										{currentSet.rpe === n
											? 'bg-text-primary text-bg border-text-primary'
											: 'bg-surface-elevated text-text-secondary border-border hover:text-text-primary hover:border-border-active'}"
								>
									{n}
								</button>
							{/each}
						</div>
						<p class="text-[11px] text-text-muted">1 = very easy · 10 = max effort</p>
					</div>
				{/if}

				<!-- Inline notes textarea -->
				{#if notesOpen}
					<div class="mb-4">
						<Textarea
							value={currentSet.notes ?? ''}
							placeholder="Note for this set"
							rows={2}
							onchange={setNotes}
						/>
					</div>
				{/if}

				<!-- Completed indicator if set was already done -->
				{#if currentSet.completed}
					<div class="flex items-center justify-center gap-2 text-success mb-2">
						<Check class="w-4 h-4" />
						<span class="text-sm font-medium">Set completed</span>
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Sticky bottom action stack -->
	<div
		class="sticky bottom-0 left-0 right-0 bg-surface border-t border-border px-4 pt-3 pb-3 z-30"
		style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));"
	>
		<div class="max-w-md mx-auto space-y-2">
			<!-- Primary: Complete (sole lime moment) -->
			<Button
				variant="primary"
				fullWidth
				size="lg"
				onclick={onComplete}
			>
				<Check class="w-5 h-5" />
				Complete set
			</Button>

			<!-- Secondary row: Skip + Timer -->
			<div class="grid grid-cols-2 gap-2">
				<Button variant="secondary" fullWidth size="md" onclick={onSkip}>
					Skip
				</Button>
				<Button variant="secondary" fullWidth size="md" onclick={onStartTimer}>
					<Timer class="w-4 h-4" />
					Rest
				</Button>
			</div>

			<!-- Persistent finish workout -->
			<button
				type="button"
				onclick={onFinishWorkout}
				class="w-full text-center text-sm font-medium text-text-secondary hover:text-text-primary transition-colors py-1.5"
			>
				Finish workout
			</button>
		</div>
	</div>
</div>