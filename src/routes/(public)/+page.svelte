<script lang="ts">
	import { calculateDailyWorkouts, getLastWorkoutDate, calculateStreakDays } from '$lib/dashboardMetrics';
	import { Numeric, EmptyState, Card, Page } from '$lib/ui';
	import { Check, Scale, UtensilsCrossed } from 'lucide-svelte';
	import { DumbbellMark } from '$lib/icons';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import { db } from '$lib/db';
	import TodayHero from '$lib/components/TodayHero.svelte';
	import RoutineCard from '$lib/components/RoutineCard.svelte';
	import StreakBadge from '$lib/components/StreakBadge.svelte';
	import type { Session, Workout, Weight, FoodEntry } from '$lib/types';

	const sessionsCol = db.collection('sessions');
	const workoutsCol = db.collection('workouts');
	const weightsCol = db.collection('weights');
	const foodEntriesCol = db.collection('foodEntries');

	let sessions = $state<Session[]>([]);
	let routines = $state<Workout[]>([]);
	let latestWeight = $state<Weight | null>(null);
	let todayFoodEntries = $state<FoodEntry[]>([]);
	let inProgressSession = $state<{
		sessionId: string;
		elapsedMinutes: number;
		exerciseCount: number;
	} | null>(null);
	let now = $state(Date.now());

	function toLocalDateString(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	const today = $derived(toLocalDateString(new Date(now)));

	$effect(() => {
		sessionsCol.orderBy('date').reverse().get().then((data) => {
			sessions = data as Session[];
		});
	});

	$effect(() => {
		workoutsCol.orderBy('createdAt').reverse().get().then((data) => {
			routines = data as Workout[];
		});
	});

	$effect(() => {
		weightsCol.orderBy('date').reverse().get().then((data) => {
			const list = data as Weight[];
			latestWeight = list.length > 0 ? list[0] : null;
		});
	});

	$effect(() => {
		foodEntriesCol.where('date').equals(today).get().then((data) => {
			todayFoodEntries = data as FoodEntry[];
		});
	});

	// Detect any in-progress session via localStorage
	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key || !key.startsWith('gym-app-session-')) continue;
			const raw = localStorage.getItem(key);
			if (!raw) continue;
			try {
				const data = JSON.parse(raw);
				const sessionId = key.slice('gym-app-session-'.length);
				const startTime = data.sessionStartTime ?? Date.now();
				const elapsedMinutes = Math.max(0, Math.floor((Date.now() - startTime) / 1000 / 60));
				const exerciseCount = Array.isArray(data.sessionExercises)
					? data.sessionExercises.filter((ex: { sets?: { completed: boolean }[] }) =>
							ex.sets?.some((s) => s.completed)
						).length
					: 0;
				inProgressSession = { sessionId, elapsedMinutes, exerciseCount };
				return;
			} catch {
				/* skip bad entry */
			}
		}
		inProgressSession = null;
	});

	function discardInProgressSession(sessionId: string) {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(`gym-app-session-${sessionId}`);
		}
		inProgressSession = null;
	}

	const lastWorkoutDate = $derived(getLastWorkoutDate(sessions));

	const lastSession = $derived(sessions.length > 0 ? sessions[0] : null);

	const sessionToday = $derived(
		sessions.some((s) => toLocalDateString(new Date(s.date)) === today)
	);

	const daysSinceLast = $derived.by(() => {
		if (!lastWorkoutDate) return Infinity;
		const startOfToday = new Date(now);
		startOfToday.setHours(0, 0, 0, 0);
		const startOfLast = new Date(lastWorkoutDate);
		startOfLast.setHours(0, 0, 0, 0);
		return Math.floor(
			(startOfToday.getTime() - startOfLast.getTime()) / (24 * 60 * 60 * 1000)
		);
	});

	const heroMode = $derived.by(() => {
		if (inProgressSession) return 'resume' as const;
		if (sessionToday) return 'done-today' as const;
		if (lastSession && daysSinceLast >= 2) return 'repeat-last' as const;
		return 'fresh' as const;
	});

	// Streak: count consecutive days with at least one session, starting from today
	// (or yesterday if no session today).
	const streakDays = $derived(calculateStreakDays(sessions, new Date(now)));

	const todayKcal = $derived(
		todayFoodEntries.reduce((acc, e) => acc + (e.macros?.kcal ?? 0), 0)
	);

	const last7Days = $derived(calculateDailyWorkouts(sessions, 7));

	const topRoutines = $derived(routines.slice(0, 3));

	const isFullyEmpty = $derived(
		sessions.length === 0 && routines.length === 0 && todayFoodEntries.length === 0
	);

	function formatWeight(kg: number): string {
		if (preferencesStore.weightUnit === 'lb') {
			return (kg * 2.20462).toFixed(1);
		}
		return kg.toFixed(1);
	}

	function dayLetter(dateStr: string): string {
		// dateStr is YYYY-MM-DD; build local date
		const [y, m, d] = dateStr.split('-').map(Number);
		const date = new Date(y, m - 1, d);
		return date.toLocaleDateString('en-US', { weekday: 'narrow' });
	}
</script>

<Page title="Today" maxWidth="7xl">
	{#snippet children()}
		{#if isFullyEmpty}
			<Card padding="lg" class="mb-6">
				{#snippet children()}
					<EmptyState
						title="Welcome to GymTrack"
						description="Track your sessions and watch your progress build over time."
						actionLabel="Start your first workout"
						actionHref="/session/new"
					>
						{#snippet icon()}
							<DumbbellMark />
						{/snippet}
					</EmptyState>
					<div class="text-center mt-2">
						<a
							href="/onboarding"
							class="text-sm text-text-secondary hover:text-text-primary underline"
						>
							Or set up your goals first
						</a>
					</div>
				{/snippet}
			</Card>
		{:else}
			<!-- 1. Hero CTA -->
			<div class="mb-6">
				<TodayHero
					mode={heroMode}
					inProgress={inProgressSession}
					lastSession={lastSession}
					ondiscard={discardInProgressSession}
				/>
			</div>

			<!-- 2. Today strip -->
			<div class="mb-6 flex flex-wrap gap-2 sm:gap-3">
				{#if latestWeight}
					<a
						href="/progress"
						class="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 hover:border-border-active hover:bg-surface-elevated transition-colors"
					>
						<Scale class="w-4 h-4 text-text-secondary" />
						<span class="font-display font-semibold text-sm text-text-primary">
							{formatWeight(latestWeight.kg)}
						</span>
						<span class="text-xs text-text-muted">{preferencesStore.weightLabel}</span>
					</a>
				{/if}

				{#if streakDays > 0}
					<StreakBadge days={streakDays} />
				{/if}

				{#if todayFoodEntries.length > 0}
					<a
						href="/log"
						class="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 hover:border-border-active hover:bg-surface-elevated transition-colors"
					>
						<UtensilsCrossed class="w-4 h-4 text-text-secondary" />
						<span class="font-display font-semibold text-sm text-text-primary">
							{todayKcal}
						</span>
						<span class="text-xs text-text-muted">kcal</span>
					</a>
				{/if}

				<div
					class="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5"
				>
					{#if sessionToday}
						<Check class="w-4 h-4 text-success" />
						<span class="text-sm text-text-primary font-semibold">Trained today</span>
					{:else}
						<span class="h-2 w-2 rounded-full bg-text-muted/50"></span>
						<span class="text-sm text-text-secondary">No session yet</span>
					{/if}
				</div>
			</div>

			<!-- 3. Routines shortcut row -->
			<section class="mb-6">
				<div class="flex items-baseline justify-between mb-3">
					<h2 class="font-display font-bold text-lg text-text-primary">Routines</h2>
					{#if routines.length > 0}
						<a
							href="/train"
							class="text-sm text-text-secondary hover:text-text-primary"
						>
							All routines →
						</a>
					{/if}
				</div>

				{#if topRoutines.length === 0}
					<Card padding="lg">
						{#snippet children()}
							<EmptyState
								title="Save a routine for one-tap workouts"
								description="Build a routine once, then start it anytime from here."
								actionLabel="Create routine"
								actionHref="/train"
							/>
						{/snippet}
					</Card>
				{:else}
					<div class="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 snap-x">
						{#each topRoutines as routine (routine.id)}
							<div class="snap-start shrink-0">
								<RoutineCard {routine} />
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- 4. Last 7 days strip -->
			<section class="mb-6">
				<div class="flex items-baseline justify-between mb-3">
					<h2 class="font-display font-bold text-lg text-text-primary">Last 7 days</h2>
					<a
						href="/progress"
						class="text-sm text-text-secondary hover:text-text-primary"
					>
						See progress →
					</a>
				</div>
				<Card padding="md">
					{#snippet children()}
						<div class="grid grid-cols-7 gap-1.5 sm:gap-2">
							{#each last7Days as day (day.date)}
								{@const trained = day.count > 0}
								{@const isToday = day.date === today}
								<div class="flex flex-col items-center gap-1.5">
									<div
										class="flex h-10 w-full items-center justify-center rounded-lg border text-xs font-semibold {trained
											? 'bg-success/15 border-success/30 text-success'
											: 'bg-surface-elevated border-border text-text-muted'}"
									>
										{#if trained}
											<span class="h-1.5 w-1.5 rounded-full bg-success"></span>
										{:else}
											<span class="h-1.5 w-1.5 rounded-full bg-text-muted/30"></span>
										{/if}
									</div>
									<span
										class="text-[10px] uppercase tracking-wider {isToday
											? 'text-text-primary font-bold'
											: 'text-text-muted'}"
									>
										{dayLetter(day.date)}
									</span>
								</div>
							{/each}
						</div>
					{/snippet}
				</Card>
			</section>
		{/if}
	{/snippet}
</Page>
