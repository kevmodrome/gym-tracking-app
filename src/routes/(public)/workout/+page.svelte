<script lang="ts">
	import { db } from '$lib/db';
	import type { Workout } from '$lib/types';
	import { Button, Card, PageHeader } from '$lib/ui';
	import PlusIcon from '$lib/components/PlusIcon.svelte';
	import { invalidateWorkouts } from '$lib/invalidation';

	let { data } = $props();

	async function copyWorkout(workout: Workout) {
		const copiedWorkout: Workout = {
			id: Date.now().toString(),
			name: `${workout.name} (Copy)`,
			exercises: workout.exercises.map((exercise) => ({
				exerciseId: exercise.exerciseId,
				exerciseName: exercise.exerciseName,
				targetSets: exercise.targetSets,
				targetReps: exercise.targetReps,
				targetWeight: exercise.targetWeight
			})),
			notes: workout.notes,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		await db.workouts.add(copiedWorkout);
		await invalidateWorkouts();
	}
</script>

<svelte:head>
	<title>Workout - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-4xl mx-auto w-full">
		<PageHeader title="Workouts">
			{#snippet actions()}
				<Button variant="secondary" href="/workout/new">
					<PlusIcon class="w-4 h-4 sm:w-5 sm:h-5" />
					<span class="hidden sm:inline">Create Workout</span>
				</Button>
			{/snippet}
		</PageHeader>

		<Card>
			{#snippet children()}
				{#if data.workouts.length === 0}
					<div class="text-center py-8">
						<p class="text-text-secondary mb-4">No workouts created yet.</p>
						<Button variant="primary" href="/workout/new">
							Create a Workout
						</Button>
					</div>
				{:else}
					<div class="space-y-3">
						{#each data.workouts as workout}
							<div class="border border-border rounded-lg hover:bg-accent/5 hover:border-accent/50 transition-colors">
								<div class="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
									<a
										href="/workout/{workout.id}"
										class="flex-1 text-left min-h-[44px] flex items-center"
									>
										<div>
											<h3 class="font-semibold text-text-primary text-base sm:text-lg">{workout.name}</h3>
											<p class="text-sm text-text-secondary">
												{workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
											</p>
										</div>
									</a>
									<div class="flex gap-2">
										<Button
											variant="primary"
											size="sm"
											href="/session/{workout.id}"
											onclick={(e: MouseEvent) => e.stopPropagation()}
										>
											Start
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={(e: MouseEvent) => {
												e.stopPropagation();
												copyWorkout(workout);
											}}
										>
											Copy
										</Button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/snippet}
		</Card>

	</div>
</div>
