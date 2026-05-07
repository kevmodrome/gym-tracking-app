<script lang="ts">
	import { db } from '$lib/db';
	import type { Exercise, PersonalRecord, PRHistory, Session } from '$lib/types';
	import { Card, SearchInput, Select, Numeric, EmptyState } from '$lib/ui';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import { formatMuscle } from '$lib/formatUtils';
	import { getRepRangeLabel } from '$lib/prUtils';
	import { Trophy } from 'lucide-svelte';

	const exercisesCol = db.collection('exercises');
	const personalRecordsCol = db.collection('personalRecords');
	const sessionsCol = db.collection('sessions');

	let exercises = $state<Exercise[]>([]);
	let allPRs = $state<PersonalRecord[]>([]);
	let allHistory = $state<Map<string, PRHistory[]>>(new Map());

	$effect(() => {
		exercisesCol.get().then((data) => {
			exercises = data as Exercise[];
		});
	});

	$effect(() => {
		(async () => {
			const prs = (await personalRecordsCol.get()) as PersonalRecord[];
			allPRs = prs;

			// Build full per-exercise PR timeline (PRs by reps, in chronological order)
			const sessions = ((await sessionsCol.get()) as Session[]).filter(
				(s) => s.status === 'completed'
			);
			const map = new Map<string, PRHistory[]>();

			for (const pr of prs) {
				if (map.has(pr.exerciseId)) continue;
				const history: PRHistory[] = [];
				for (const session of sessions) {
					const ex = (session as any).exercises.find(
						(e: any) => e.exerciseId === pr.exerciseId
					);
					if (!ex) continue;
					for (const set of ex.sets) {
						if (
							set.completed &&
							!set.warmup &&
							typeof set.weight === 'number' &&
							Number.isFinite(set.weight)
						) {
							history.push({
								reps: set.reps,
								weight: set.weight,
								achievedDate: (session as any).date,
								sessionId: (session as any).id
							});
						}
					}
				}
				history.sort(
					(a, b) => new Date(a.achievedDate).getTime() - new Date(b.achievedDate).getTime()
				);
				// Compute the timeline of "best at the time" PRs (per rep range)
				const bestByReps = new Map<number, number>();
				const timeline: PRHistory[] = [];
				for (const h of history) {
					const prev = bestByReps.get(h.reps) ?? 0;
					if (h.weight > prev) {
						bestByReps.set(h.reps, h.weight);
						timeline.push(h);
					}
				}
				// Most recent first
				timeline.reverse();
				map.set(pr.exerciseId, timeline);
			}
			allHistory = map;
		})();
	});

	// Filters
	let searchQuery = $state('');
	let muscleFilter = $state<string>('all');

	function getExercise(exerciseId: string): Exercise | undefined {
		return exercises.find((e) => e.id === exerciseId);
	}

	function getExerciseName(exerciseId: string): string {
		return getExercise(exerciseId)?.name ?? 'Unknown Exercise';
	}

	function getExerciseMuscle(exerciseId: string): string {
		return getExercise(exerciseId)?.primary_muscle ?? '';
	}

	const muscleOptions = $derived.by(() => {
		const muscles = new Set<string>();
		for (const pr of allPRs) {
			const m = getExerciseMuscle(pr.exerciseId);
			if (m) muscles.add(m);
		}
		return [
			{ value: 'all', label: 'All muscles' },
			...Array.from(muscles)
				.sort()
				.map((m) => ({ value: m, label: formatMuscle(m) }))
		];
	});

	const groupedPRs = $derived.by(() => {
		const groups = new Map<string, PersonalRecord[]>();
		for (const pr of allPRs) {
			const list = groups.get(pr.exerciseId) ?? [];
			list.push(pr);
			groups.set(pr.exerciseId, list);
		}

		const q = searchQuery.trim().toLowerCase();

		return Array.from(groups.entries())
			.map(([exerciseId, prs]) => ({
				exerciseId,
				exerciseName: getExerciseName(exerciseId),
				muscle: getExerciseMuscle(exerciseId),
				prs: [...prs].sort((a, b) => a.reps - b.reps),
				timeline: allHistory.get(exerciseId) ?? []
			}))
			.filter((g) => {
				if (muscleFilter !== 'all' && g.muscle !== muscleFilter) return false;
				if (!q) return true;
				return (
					g.exerciseName.toLowerCase().includes(q) || g.muscle.toLowerCase().includes(q)
				);
			})
			.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
	});

	function formatShortDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

{#if allPRs.length === 0}
	<Card padding="lg">
		{#snippet children()}
			<EmptyState
				title="No personal records yet"
				description="Log a set with weight to start tracking PRs by rep range."
				actionLabel="Start a session"
				actionHref="/train"
			>
				{#snippet icon()}<Trophy />{/snippet}
			</EmptyState>
		{/snippet}
	</Card>
{:else}
	<Card class="mb-4">
		{#snippet children()}
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
				<SearchInput
					label="Search"
					bind:value={searchQuery}
					placeholder="Search exercise or muscle..."
				/>
				<Select label="Muscle group" bind:value={muscleFilter} options={muscleOptions} />
			</div>
		{/snippet}
	</Card>

	{#if groupedPRs.length === 0}
		<Card padding="lg">
			{#snippet children()}
				<EmptyState
					title="No matches"
					description="Try clearing the filters or searching for a different exercise."
				>
					{#snippet icon()}<Trophy />{/snippet}
				</EmptyState>
			{/snippet}
		</Card>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
			{#each groupedPRs as group (group.exerciseId)}
				<Card>
					{#snippet children()}
						<div class="mb-4">
							<h2 class="text-lg sm:text-xl font-display font-bold text-text-primary">
								{group.exerciseName}
							</h2>
							{#if group.muscle}
								<p class="text-xs text-text-muted">{formatMuscle(group.muscle)}</p>
							{/if}
						</div>

						<!-- Current best PRs by rep range -->
						<div class="space-y-2 mb-5">
							<p class="text-xs uppercase tracking-wider text-text-muted font-semibold">
								Current best
							</p>
							{#each group.prs as pr (pr.id)}
								<div
									class="flex items-center justify-between gap-2 p-3 rounded-lg border border-pr/30 bg-pr/5"
								>
									<div class="flex items-center gap-3">
										<div
											class="w-9 h-9 rounded-full bg-pr/15 flex items-center justify-center flex-shrink-0"
										>
											<Trophy class="w-4 h-4 text-pr" />
										</div>
										<div>
											<p class="text-xs text-text-muted">
												{getRepRangeLabel(pr.reps)} · {pr.reps} rep{pr.reps !== 1 ? 's' : ''}
											</p>
											<p>
												<Numeric
													value={pr.weight}
													size="inline"
													tone="pr"
													unit={preferencesStore.weightLabel}
												/>
											</p>
										</div>
									</div>
									<p class="text-xs text-text-muted">{formatShortDate(pr.achievedDate)}</p>
								</div>
							{/each}
						</div>

						<!-- PR timeline -->
						{#if group.timeline.length > 0}
							<div>
								<p class="text-xs uppercase tracking-wider text-text-muted font-semibold mb-2">
									PR timeline
								</p>
								<ol class="relative border-l border-border ml-2 space-y-2">
									{#each group.timeline as entry, i}
										<li class="ml-4 pl-1">
											<span
												class="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full {i === 0
													? 'bg-pr ring-2 ring-pr/30'
													: 'bg-border'}"
											></span>
											<div class="flex items-baseline justify-between gap-2">
												<p class="text-sm text-text-primary font-medium">
													{entry.weight}
													{preferencesStore.weightLabel} × {entry.reps} reps
												</p>
												<p class="text-xs text-text-muted">
													{formatShortDate(entry.achievedDate)}
												</p>
											</div>
										</li>
									{/each}
								</ol>
							</div>
						{/if}
					{/snippet}
				</Card>
			{/each}
		</div>
	{/if}
{/if}
