<script lang="ts">
	import type { Session } from '$lib/types';
	import { Numeric, Button, Textarea, Card } from '$lib/ui';
	import { calculateSessionVolume } from '$lib/dashboardMetrics';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import StreakBadge from '$lib/components/StreakBadge.svelte';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import { onMount } from 'svelte';

	interface DetectedPR {
		exerciseName: string;
		repRange: string;
		weight: number;
		reps: number;
		previousBest?: { weight: number; reps: number };
	}

	interface CelebrationProps {
		session: Pick<Session, 'exercises' | 'duration'>;
		volumeDelta: number;
		prs: DetectedPR[];
		streakDays: number;
		onSave: () => void;
		notes: string;
	}

	let {
		session,
		volumeDelta,
		prs,
		streakDays,
		onSave,
		notes = $bindable()
	}: CelebrationProps & { notes: string } = $props();

	let reducedMotion = $state(false);
	let mounted = $state(false);

	onMount(() => {
		if (typeof window !== 'undefined') {
			const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
			reducedMotion = mq.matches;
			const handler = (e: MediaQueryListEvent) => {
				reducedMotion = e.matches;
			};
			mq.addEventListener('change', handler);
			// Trigger animation start on next frame
			requestAnimationFrame(() => {
				mounted = true;
			});
			return () => mq.removeEventListener('change', handler);
		}
	});

	const totalVolume = $derived(Math.round(calculateSessionVolume({ exercises: session.exercises })));

	const completedSets = $derived(
		session.exercises.reduce(
			(acc, ex) => acc + ex.sets.filter((s) => s.completed && !s.warmup).length,
			0
		)
	);

	const exerciseCount = $derived(session.exercises.length);

	const durationMin = $derived(Math.max(0, Math.round(session.duration ?? 0)));

	function formatVolume(v: number): string {
		const display = preferencesStore.weightUnit === 'lb' ? Math.round(v * 2.20462) : v;
		return display.toLocaleString();
	}

	function formatDeltaSigned(delta: number): string {
		const display =
			preferencesStore.weightUnit === 'lb' ? Math.round(delta * 2.20462) : Math.round(delta);
		const prefix = display > 0 ? '+' : '';
		return `${prefix}${display.toLocaleString()}`;
	}

	const eyebrowText = $derived(prs.length > 0 ? 'Nice work.' : 'Workout complete');
</script>

<div class="flex flex-col h-full">
	<div class="flex-1 overflow-y-auto px-4 py-8 pb-48 md:pb-8">
		<div class="max-w-md mx-auto">
			<!-- Eyebrow -->
			<p
				class="celebration-eyebrow text-center text-xs uppercase tracking-[0.2em] font-semibold text-text-secondary mb-6"
				class:reduced={reducedMotion}
				class:visible={mounted}
			>
				{eyebrowText}
			</p>

			<!-- Hero numerals -->
			<div
				class="celebration-hero text-center mb-3"
				class:reduced={reducedMotion}
				class:visible={mounted}
			>
				<Numeric
					value={formatVolume(totalVolume)}
					unit={preferencesStore.weightLabel}
					tone="focal"
					size="display"
				/>
				<p class="mt-2 text-xs uppercase tracking-[0.2em] text-text-muted font-semibold">
					Total volume
				</p>
			</div>

			<!-- Delta line -->
			<div
				class="celebration-delta text-center mb-8"
				class:reduced={reducedMotion}
				class:visible={mounted}
			>
				{#if volumeDelta === 0 || !Number.isFinite(volumeDelta)}
					<span class="text-sm text-text-muted">First time tracking this</span>
				{:else}
					<span
						class="text-sm font-medium {volumeDelta > 0 ? 'text-success' : 'text-danger'}"
					>
						{formatDeltaSigned(volumeDelta)}
						{preferencesStore.weightLabel} vs last
					</span>
				{/if}
			</div>

			<!-- PR card stack -->
			{#if prs.length > 0}
				<div class="space-y-2 mb-6">
					{#each prs as pr, i (pr.exerciseName + pr.reps)}
						<div
							class="celebration-pr"
							class:reduced={reducedMotion}
							class:visible={mounted}
							style="--pr-delay: {650 + i * 80}ms"
						>
							<Card class="border-pr/30 bg-pr/5">
								<div class="flex items-center justify-between gap-3">
									<div class="min-w-0 flex-1">
										<p class="text-[10px] uppercase tracking-[0.18em] text-pr font-bold mb-0.5">
											New PR · {pr.repRange}
										</p>
										<p class="text-sm font-medium text-text-primary truncate">
											{pr.exerciseName}
										</p>
										{#if pr.previousBest}
											<p class="text-[11px] text-text-muted mt-0.5">
												prev {formatVolume(pr.previousBest.weight)}
												{preferencesStore.weightLabel} × {pr.previousBest.reps}
											</p>
										{/if}
									</div>
									<div class="text-right shrink-0">
										<Numeric
											value={formatVolume(pr.weight)}
											unit={preferencesStore.weightLabel}
											tone="pr"
											size="hero"
										/>
										<p class="text-xs text-text-muted mt-0.5">× {pr.reps} reps</p>
									</div>
								</div>
							</Card>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Streak indicator -->
			{#if streakDays > 0}
				<div
					class="celebration-streak flex justify-center mb-6"
					class:reduced={reducedMotion}
					class:visible={mounted}
				>
					<StreakBadge days={streakDays} />
				</div>
			{/if}

			<!-- Stat row -->
			<div
				class="celebration-stats grid grid-cols-3 gap-3 mb-6"
				class:reduced={reducedMotion}
				class:visible={mounted}
			>
				<div class="text-center rounded-lg border border-border bg-surface-elevated px-2 py-3">
					<Numeric value={durationMin} size="inline" />
					<p class="mt-1 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
						min
					</p>
				</div>
				<div class="text-center rounded-lg border border-border bg-surface-elevated px-2 py-3">
					<Numeric value={completedSets} size="inline" />
					<p class="mt-1 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
						sets
					</p>
				</div>
				<div class="text-center rounded-lg border border-border bg-surface-elevated px-2 py-3">
					<Numeric value={exerciseCount} size="inline" />
					<p class="mt-1 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
						exercises
					</p>
				</div>
			</div>

			<!-- Optional notes -->
			<div
				class="celebration-notes mb-2"
				class:reduced={reducedMotion}
				class:visible={mounted}
			>
				<Textarea
					label="Notes for this session"
					bind:value={notes}
					placeholder="How did it go?"
					rows={3}
				/>
			</div>
		</div>
	</div>

	<ActionBar>
		<div
			class="celebration-action w-full"
			class:reduced={reducedMotion}
			class:visible={mounted}
		>
			<Button variant="primary" fullWidth size="lg" onclick={onSave}>
				Save &amp; continue
			</Button>
		</div>
	</ActionBar>
</div>

<style>
	/* Initial (pre-mount) state */
	.celebration-eyebrow,
	.celebration-hero,
	.celebration-delta,
	.celebration-pr,
	.celebration-streak,
	.celebration-stats,
	.celebration-notes,
	.celebration-action {
		opacity: 0;
	}

	.celebration-hero {
		transform: scale(0.92);
	}

	.celebration-delta,
	.celebration-pr,
	.celebration-streak,
	.celebration-stats,
	.celebration-notes,
	.celebration-action {
		transform: translateY(8px);
	}

	/* Visible state with staggered timing */
	.celebration-eyebrow.visible {
		animation: fadeIn 150ms ease-out 0ms forwards;
	}

	.celebration-hero.visible {
		animation: heroIn 400ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms forwards;
	}

	.celebration-delta.visible {
		animation: slideUp 200ms ease-out 450ms forwards;
	}

	.celebration-pr.visible {
		animation: slideUp 280ms cubic-bezier(0.2, 0.8, 0.2, 1) var(--pr-delay, 650ms) forwards;
	}

	.celebration-streak.visible {
		animation: fadeIn 200ms ease-out 950ms forwards;
	}

	.celebration-stats.visible {
		animation: fadeIn 200ms ease-out 1000ms forwards;
	}

	.celebration-notes.visible {
		animation: fadeIn 200ms ease-out 1100ms forwards;
	}

	.celebration-action.visible {
		animation: fadeIn 200ms ease-out 1200ms forwards;
	}

	/* Reduced motion: all stages render instantly when visible */
	.celebration-eyebrow.reduced.visible,
	.celebration-hero.reduced.visible,
	.celebration-delta.reduced.visible,
	.celebration-pr.reduced.visible,
	.celebration-streak.reduced.visible,
	.celebration-stats.reduced.visible,
	.celebration-notes.reduced.visible,
	.celebration-action.reduced.visible {
		animation: none;
		opacity: 1;
		transform: none;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes heroIn {
		from {
			opacity: 0;
			transform: scale(0.92);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
