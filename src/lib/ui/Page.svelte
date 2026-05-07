<script lang="ts">
	import type { Snippet } from 'svelte';
	import PageHeader from './PageHeader.svelte';

	type MaxWidth = '2xl' | '3xl' | '5xl' | '7xl';

	interface Props {
		title: string;
		maxWidth?: MaxWidth;
		showSettings?: boolean;
		actions?: Snippet;
		children: Snippet;
		contentClass?: string;
		class?: string;
	}

	let {
		title,
		maxWidth = '7xl',
		showSettings = true,
		actions,
		children,
		contentClass = '',
		class: className = ''
	}: Props = $props();

	const maxWidthClass = $derived(
		maxWidth === '2xl'
			? 'max-w-2xl'
			: maxWidth === '3xl'
				? 'max-w-3xl'
				: maxWidth === '5xl'
					? 'max-w-5xl'
					: 'max-w-7xl'
	);
</script>

<div class="min-h-screen bg-bg p-4 md:p-6 lg:p-8 {className}">
	<div class="{maxWidthClass} mx-auto w-full {contentClass}">
		<PageHeader {title} {actions} {showSettings} />
		{@render children()}
	</div>
</div>
