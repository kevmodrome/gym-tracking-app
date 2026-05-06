<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import type { Workout, Session } from '$lib/types';
	import { Button, Card, EmptyState, PageHeader, ConfirmDialog } from '$lib/ui';
	import { Plus, Play, Pencil, Copy, Trash2, ChevronRight, Dumbbell, ListChecks } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toast.svelte';

	const workoutsCol = db.collection('workouts');
	const sessionsCol = db.collection('sessions');

	let routines = $state<Workout[]>([]);
	let sessions = $state<Session[]>([]);
	let loading = $state(true);

	let confirmDeleteId = $state<string | null>(null);

	async function loadAll() {
		const [w, s] = await Promise.all([
			workoutsCol.orderBy('createdAt').reverse().get(),
			sessionsCol.orderBy('date').reverse().get()
		]);
		routines = w as Workout[];
		sessions = s as Session[];
		loading = false;
	}

	$effect(() => {
		loadAll();
	});

	const recentSessions = $derived(sessions.slice(0, 5));

	// For each routine, derive the most recent session that contains all of
	// the routine's exercise IDs (heuristic — we don't store routineId on sessions).
	function lastPerformedFor(routine: Workout): string | null {
		if (!routine.exercises || routine.exercises.length === 0) return null;
		const routineIds = new Set(routine.exercises.map((e) => e.exerciseId));
		for (const session of sessions) {
			if (session.exercises.length < routineIds.size) continue;
			const sessionIds = new Set(session.exercises.map((e) => e.exerciseId));
			let allMatch = true;
			for (const id of routineIds) {
				if (!sessionIds.has(id)) {
					allMatch = false;
					break;
				}
			}
			if (allMatch) return session.date;
		}
		return null;
	}

	function muscleSummary(routine: Workout): string {
		const names = routine.exercises?.map((e) => e.exerciseName).filter(Boolean) ?? [];
		if (names.length === 0) return '';
		// Short summary: first 2 names, then +N more
		if (names.length <= 2) return names.join(', ');
		return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
	}

	function formatLastPerformed(date: string | null): string {
		if (!date) return 'Never performed';
		const d = new Date(date);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
		return d.toLocaleDateString();
	}

	function formatSessionDate(date: string): string {
		const d = new Date(date);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		return d.toLocaleDateString();
	}

	async function createNewRoutine() {
		const now = new Date().toISOString();
		const newId = await workoutsCol.add({
			name: 'New routine',
			exercises: [],
			createdAt: now,
			updatedAt: now
		});
		await goto(`/train/routines/${newId}`);
	}

	async function duplicateRoutine(routine: Workout) {
		const now = new Date().toISOString();
		await workoutsCol.add({
			name: `${routine.name} (copy)`,
			exercises: routine.exercises.map((e) => ({ ...e })),
			notes: routine.notes,
			createdAt: now,
			updatedAt: now
		});
		toastStore.showSuccess('Routine duplicated');
		await loadAll();
	}

	function askDelete(routineId: string) {
		confirmDeleteId = routineId;
	}

	async function confirmDelete() {
		if (!confirmDeleteId) return;
		const id = confirmDeleteId;
		confirmDeleteId = null;
		await workoutsCol.delete(id);
		toastStore.showSuccess('Routine deleted');
		await loadAll();
	}

	function cancelDelete() {
		confirmDeleteId = null;
	}
</script>

<div class="container mx-auto max-w-3xl px-4 pb-12">
	<PageHeader title="Train">
		{#snippet actions()}
			<Button variant="secondary" size="sm" onclick={createNewRoutine}>
				<Plus class="w-4 h-4" />
				New routine
			</Button>
		{/snippet}
	</PageHeader>

	<!-- Routines section -->
	<section class="mb-8">
		<div class="flex items-center justify-between mb-4">
			<h2 class="font-display font-bold text-xl text-text-primary">Routines</h2>
		</div>

		{#if loading}
			<Card>
				{#snippet children()}
					<p class="text-text-muted text-sm">Loading...</p>
				{/snippet}
			</Card>
		{:else if routines.length === 0}
			<Card padding="none">
				{#snippet children()}
					<EmptyState
						title="Save your first routine"
						description="Build a routine once, start it any time with one tap."
						actionLabel="+ New routine"
						onAction={createNewRoutine}
					>
						{#snippet icon()}
							<ListChecks />
						{/snippet}
					</EmptyState>
				{/snippet}
			</Card>
		{:else}
			<div class="grid gap-3">
				{#each routines as routine (routine.id)}
					{@const last = lastPerformedFor(routine)}
					{@const summary = muscleSummary(routine)}
					<div class="rounded-xl border border-border bg-surface overflow-hidden">
						<div class="p-4 flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<h3 class="font-display font-semibold text-base text-text-primary truncate">
									{routine.name}
								</h3>
								<p class="mt-1 text-xs text-text-muted">
									{routine.exercises?.length ?? 0} exercise{(routine.exercises?.length ?? 0) === 1
										? ''
										: 's'}{summary ? ` · ${summary}` : ''}
								</p>
								<p class="mt-1 text-xs text-text-muted">{formatLastPerformed(last)}</p>
							</div>
						</div>
						<div class="border-t border-border bg-surface-elevated/40 px-2 py-2 flex items-center gap-1 flex-wrap">
							<Button
								variant="primary"
								size="sm"
								href={`/session/new?routine=${routine.id}`}
							>
								<Play class="w-3.5 h-3.5" />
								Start
							</Button>
							<Button
								variant="ghost"
								size="sm"
								href={`/train/routines/${routine.id}`}
							>
								<Pencil class="w-3.5 h-3.5" />
								Edit
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => duplicateRoutine(routine)}
							>
								<Copy class="w-3.5 h-3.5" />
								Duplicate
							</Button>
							<Button
								variant="ghost"
								size="sm"
								class="ml-auto text-danger hover:text-danger"
								onclick={() => askDelete(routine.id)}
							>
								<Trash2 class="w-3.5 h-3.5" />
								Delete
							</Button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- All exercises quick link -->
	<section class="mb-8">
		<a
			href="/exercises"
			class="block rounded-xl border border-border bg-surface hover:bg-surface-elevated hover:border-border-active transition-all duration-200 p-4"
		>
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-3 min-w-0">
					<div class="p-2 rounded-lg bg-surface-elevated text-text-secondary">
						<Dumbbell class="w-5 h-5" />
					</div>
					<div class="min-w-0">
						<h3 class="font-display font-semibold text-base text-text-primary">
							All exercises
						</h3>
						<p class="text-xs text-text-muted truncate">
							Browse the library, manage favorites and PRs
						</p>
					</div>
				</div>
				<ChevronRight class="w-5 h-5 text-text-muted flex-shrink-0" />
			</div>
		</a>
	</section>

	<!-- Recent sessions -->
	<section>
		<div class="flex items-center justify-between mb-4">
			<h2 class="font-display font-bold text-xl text-text-primary">Recent sessions</h2>
			{#if recentSessions.length > 0}
				<a
					href="/progress/activity"
					class="text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
				>
					View all
				</a>
			{/if}
		</div>

		{#if loading}
			<Card>
				{#snippet children()}
					<p class="text-text-muted text-sm">Loading...</p>
				{/snippet}
			</Card>
		{:else if recentSessions.length === 0}
			<Card>
				{#snippet children()}
					<p class="text-text-muted text-sm">No sessions yet. Start a routine to log your first one.</p>
				{/snippet}
			</Card>
		{:else}
			<div class="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border">
				{#each recentSessions as session (session.id)}
					<a
						href="/progress/activity"
						class="flex items-center justify-between gap-3 p-4 hover:bg-surface-elevated transition-colors"
					>
						<div class="min-w-0 flex-1">
							<p class="font-medium text-sm text-text-primary">
								{formatSessionDate(session.date)}
							</p>
							<p class="text-xs text-text-muted mt-0.5">
								{session.exercises.length} exercise{session.exercises.length === 1 ? '' : 's'}
								{#if session.duration}
									· {session.duration} min
								{/if}
							</p>
						</div>
						<ChevronRight class="w-4 h-4 text-text-muted flex-shrink-0" />
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>

<ConfirmDialog
	open={confirmDeleteId !== null}
	title="Delete routine?"
	message="This will permanently remove the routine. Your past sessions are not affected."
	confirmText="Delete"
	cancelText="Cancel"
	confirmVariant="danger"
	onconfirm={confirmDelete}
	oncancel={cancelDelete}
/>
