<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import CreateExerciseModal from '$lib/components/CreateExerciseModal.svelte';
	import type { Exercise } from '$lib/types';

	async function handleExerciseCreated(exercise: Exercise) {
		goto('/exercises');
	}

	function handleClose() {
		goto('/exercises');
	}
</script>

<svelte:head>
	<title>Create Exercise - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-4xl mx-auto w-full">
		<CreateExerciseModal
			onCreate={handleExerciseCreated}
			onClose={handleClose}
		/>
	</div>
</div>
