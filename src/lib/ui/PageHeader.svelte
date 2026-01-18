<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		class?: string;
		actions?: Snippet;
	}

	let { title, class: className = '', actions }: Props = $props();
</script>

<div class="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 {className}">
	<h1 class="text-2xl sm:text-3xl font-bold font-display text-text-primary">
		{title}
	</h1>
	{#if actions}
		{@render actions()}
	{/if}
</div>

<style>
	.page-header {
		view-transition-name: page-header;
	}
</style>
