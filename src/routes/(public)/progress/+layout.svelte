<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { ButtonGroup, PageHeader } from '$lib/ui';

	let { children } = $props();

	const tabOptions = [
		{ value: 'sessions', label: 'Sessions' },
		{ value: 'charts', label: 'Charts' },
		{ value: 'records', label: 'Records' },
		{ value: 'nutrition', label: 'Nutrition' },
		{ value: 'weight', label: 'Weight' }
	];

	const currentTab = $derived.by(() => {
		const path = page.url.pathname;
		if (path.includes('/sessions')) return 'sessions';
		if (path.includes('/charts')) return 'charts';
		if (path.includes('/records')) return 'records';
		if (path.includes('/nutrition')) return 'nutrition';
		if (path.includes('/weight')) return 'weight';
		return 'sessions';
	});
</script>

<svelte:head>
	<title>Progress - Gym Recording App</title>
</svelte:head>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-7xl mx-auto w-full">
		<PageHeader title="Progress">
			{#snippet actions()}
				<ButtonGroup
					options={tabOptions}
					value={currentTab}
					onchange={(v) => {
						goto(`/progress/${v}`);
					}}
				/>
			{/snippet}
		</PageHeader>

		{@render children()}
	</div>
</div>
