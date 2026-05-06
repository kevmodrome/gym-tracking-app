<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { ButtonGroup, PageHeader } from '$lib/ui';

	let { children } = $props();

	const tabOptions = [
		{ value: 'activity', label: 'Activity' },
		{ value: 'records', label: 'Records' },
		{ value: 'body', label: 'Body' }
	];

	const currentTab = $derived.by(() => {
		const path = page.url.pathname;
		if (path.includes('/records')) return 'records';
		if (path.includes('/body')) return 'body';
		return 'activity';
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
