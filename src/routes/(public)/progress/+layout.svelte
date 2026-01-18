<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ButtonGroup } from '$lib/ui';

	let { children } = $props();

	const tabOptions = [
		{ value: 'sessions', label: 'Sessions' },
		{ value: 'charts', label: 'Charts' },
		{ value: 'records', label: 'Records' }
	];

	const currentTab = $derived(() => {
		const path = $page.url.pathname;
		if (path.includes('/sessions')) return 'sessions';
		if (path.includes('/charts')) return 'charts';
		if (path.includes('/records')) return 'records';
		return 'sessions';
	});
</script>

<svelte:head>
	<title>Progress - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-7xl mx-auto w-full">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
			<h1 class="text-2xl sm:text-3xl font-display font-bold text-text-primary">Progress</h1>
			<ButtonGroup
				options={tabOptions}
				value={currentTab()}
				onchange={(v) => {
					goto(`/progress/${v}`);
				}}
			/>
		</div>

		{@render children()}
	</div>
</div>
