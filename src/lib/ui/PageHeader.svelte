<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		class?: string;
		actions?: Snippet;
	}

	let { title, class: className = '', actions }: Props = $props();
</script>

<div class="page-header fixed top-0 left-0 right-0 z-20 px-3 py-3 sm:px-4 sm:py-4 bg-bg md:static md:px-0 md:py-0 md:bg-transparent md:z-auto md:mb-3 flex flex-row items-center justify-between gap-2 sm:gap-4 {className}">
	<h1 class="text-2xl sm:text-3xl font-bold font-display text-text-primary min-w-0 truncate">
		{title}
	</h1>
	{#if actions}
		{@render actions()}
	{/if}
</div>
<!-- Spacer for fixed header on mobile -->
<div class="h-14 sm:h-16 mb-3 md:hidden" aria-hidden="true"></div>

<style>
	.page-header {
		view-transition-name: page-header;
	}

	/* Soft gradient fade below fixed header on mobile */
	.page-header::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 1.5rem;
		transform: translateY(100%);
		background: linear-gradient(to bottom, var(--color-bg), transparent);
		pointer-events: none;
	}

	@media (min-width: 768px) {
		.page-header::after {
			display: none;
		}
	}
</style>
