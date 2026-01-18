<script lang="ts">
	import { goto } from '$app/navigation';
	import EditWorkoutModal from '$lib/components/EditWorkoutModal.svelte';
	import type { Workout } from '$lib/types';

	async function handleWorkoutCreated(workout: Workout) {
		goto('/workout');
	}

	function handleClose() {
		goto('/workout');
	}
</script>

<svelte:head>
	<title>Create Workout - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-4xl mx-auto w-full">
		<EditWorkoutModal
			onClose={handleClose}
			onWorkoutUpdated={handleWorkoutCreated}
		/>
	</div>
</div>
