<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Settings } from 'lucide-svelte';
	import { page } from '$app/state';

	interface Props {
		title: string;
		class?: string;
		actions?: Snippet;
		showSettings?: boolean;
	}

	let { title, class: className = '', actions, showSettings = true }: Props = $props();

	const isSettingsActive = $derived(page.url.pathname.startsWith('/settings'));
</script>

<div class="page-header fixed top-0 left-0 right-0 z-20 px-3 py-3 sm:px-4 sm:py-4 bg-bg md:static md:px-0 md:py-0 md:bg-transparent md:z-auto md:mb-6 flex flex-row items-center justify-between gap-2 sm:gap-4 {className}">
	<h1 class="text-2xl sm:text-3xl font-bold font-display text-text-primary min-w-0 truncate">
		{title}
	</h1>
	<div class="flex items-center gap-2">
		{#if actions}
			{@render actions()}
		{/if}
		{#if showSettings}
			<a
				href="/settings"
				aria-label="Settings"
				class="md:hidden inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-full hover:bg-surface-elevated transition-colors {isSettingsActive ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'}"
			>
				<Settings class="w-5 h-5" strokeWidth={2} />
			</a>
		{/if}
	</div>
</div>
<!-- Spacer for fixed header on mobile -->
<div class="h-14 sm:h-16 mb-6 md:hidden" aria-hidden="true"></div>

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
