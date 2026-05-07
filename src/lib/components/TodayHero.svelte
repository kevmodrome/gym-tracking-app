<script lang="ts">
	import { Numeric, Button } from '$lib/ui';
	import { Play, RotateCcw, Check } from 'lucide-svelte';
	import type { Session } from '$lib/types';

	type Mode = 'resume' | 'repeat-last' | 'fresh' | 'done-today';

	interface InProgressInfo {
		sessionId: string;
		elapsedMinutes: number;
		exerciseCount: number;
	}

	interface TodayHeroProps {
		mode: Mode;
		inProgress?: InProgressInfo | null;
		lastSession?: Session | null;
		ondiscard?: (sessionId: string) => void;
	}

	let { mode, inProgress = null, lastSession = null, ondiscard }: TodayHeroProps = $props();

	function formatLastSessionDate(iso: string): string {
		const d = new Date(iso);
		const now = new Date();
		const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const dayMs = 24 * 60 * 60 * 1000;
		const diffDays = Math.floor(
			(start.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / dayMs
		);
		if (diffDays === 0) return 'today';
		if (diffDays === 1) return 'yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	const lastSessionName = $derived.by(() => {
		if (!lastSession) return 'last workout';
		const muscles = lastSession.exercises
			?.map((e) => e.primaryMuscle)
			.filter(Boolean) as string[] | undefined;
		if (muscles && muscles.length > 0) {
			const primary = muscles[0];
			return `${primary.charAt(0).toUpperCase()}${primary.slice(1)} day`;
		}
		return 'last workout';
	});
</script>

<div
	class="relative overflow-hidden rounded-2xl border border-border bg-surface"
	style="background-image: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(197, 255, 0, 0.025) 3px, rgba(197, 255, 0, 0.025) 4px);"
>
	{#if mode === 'resume' && inProgress}
		<div class="p-6 sm:p-8">
			<p class="text-xs font-semibold uppercase tracking-wider text-focal mb-3">In progress</p>
			<h2 class="font-display font-bold text-2xl sm:text-3xl text-text-primary mb-4">
				Resume workout
			</h2>
			<div class="flex items-baseline gap-6 mb-6">
				<div>
					<Numeric value={inProgress.elapsedMinutes} unit="min" tone="focal" size="hero" />
					<p class="text-xs text-text-muted mt-1">elapsed</p>
				</div>
				<div>
					<Numeric value={inProgress.exerciseCount} size="hero" />
					<p class="text-xs text-text-muted mt-1">
						exercise{inProgress.exerciseCount === 1 ? '' : 's'}
					</p>
				</div>
			</div>
			<Button variant="primary" size="lg" href={`/session/${inProgress.sessionId}`} fullWidth>
				<Play class="w-5 h-5" />
				Resume
			</Button>
			{#if ondiscard}
				<button
					type="button"
					onclick={() => ondiscard?.(inProgress.sessionId)}
					class="mt-3 w-full text-center text-sm font-medium text-text-muted hover:text-danger transition-colors"
				>
					Discard
				</button>
			{/if}
		</div>
	{:else if mode === 'repeat-last' && lastSession}
		<div class="p-6 sm:p-8">
			<p class="text-xs font-semibold uppercase tracking-wider text-focal mb-3">
				Pick up where you left off
			</p>
			<h2 class="font-display font-bold text-2xl sm:text-3xl text-text-primary mb-2">
				Repeat <span class="text-focal">{lastSessionName}</span>
			</h2>
			<p class="text-sm text-text-secondary mb-6">
				Last done {formatLastSessionDate(lastSession.date)} ·
				{lastSession.exercises.length} exercise{lastSession.exercises.length === 1 ? '' : 's'}
			</p>
			<Button
				variant="primary"
				size="lg"
				href={`/session/new?from=${lastSession.id}`}
				fullWidth
			>
				<RotateCcw class="w-5 h-5" />
				Start workout
			</Button>
		</div>
	{:else if mode === 'done-today'}
		<div class="p-6 sm:p-8">
			<div class="flex items-center gap-3 mb-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-success/15">
					<Check class="w-5 h-5 text-success" />
				</div>
				<h2 class="font-display font-bold text-xl sm:text-2xl text-text-primary">
					Today's session done.
				</h2>
			</div>
			<p class="text-sm text-text-secondary mb-2">Nice work. Rest up.</p>
			<a
				href="/session/new"
				class="text-sm font-semibold text-focal hover:underline"
			>
				Start another →
			</a>
		</div>
	{:else}
		<div class="p-6 sm:p-8">
			<p class="text-xs font-semibold uppercase tracking-wider text-focal mb-3">Today</p>
			<h2 class="font-display font-bold text-2xl sm:text-3xl text-text-primary mb-2">
				<span class="text-focal">Start</span> a new workout
			</h2>
			<p class="text-sm text-text-secondary mb-6">
				Pick exercises as you go, or kick off from a saved routine below.
			</p>
			<Button variant="primary" size="lg" href="/session/new" fullWidth>
				<Play class="w-5 h-5" />
				Start workout
			</Button>
		</div>
	{/if}
</div>
