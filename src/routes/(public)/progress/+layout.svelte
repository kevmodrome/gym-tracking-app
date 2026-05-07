<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { ButtonGroup, Page } from '$lib/ui';

	let { children: subroute } = $props();

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

<Page title="Progress" maxWidth="7xl">
	{#snippet actions()}
		<ButtonGroup
			options={tabOptions}
			value={currentTab}
			onchange={(v) => {
				goto(`/progress/${v}`);
			}}
		/>
	{/snippet}
	{#snippet children()}
		{@render subroute()}
	{/snippet}
</Page>
