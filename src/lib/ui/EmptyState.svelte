<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	interface EmptyStateProps {
		title: string;
		description?: string;
		actionLabel?: string;
		actionHref?: string;
		onAction?: () => void;
		icon?: Snippet;
		class?: string;
	}

	let {
		title,
		description,
		actionLabel,
		actionHref,
		onAction,
		icon,
		class: className = ''
	}: EmptyStateProps = $props();

	const wrapperClasses = $derived(
		['flex flex-col items-center justify-center text-center px-6 py-12', className]
			.filter(Boolean)
			.join(' ')
	);
</script>

<div class={wrapperClasses}>
	{#if icon}
		<div class="mb-4 text-text-secondary [&_svg]:w-12 [&_svg]:h-12 sm:[&_svg]:w-16 sm:[&_svg]:h-16">
			{@render icon()}
		</div>
	{/if}
	<h3 class="font-display font-bold text-2xl text-text-primary {description ? 'mb-2' : 'mb-6'}">{title}</h3>
	{#if description}
		<p class="font-body text-text-secondary max-w-sm mb-6">{description}</p>
	{/if}
	{#if actionLabel && (actionHref || onAction)}
		<Button variant="primary" href={actionHref} onclick={onAction}>
			{actionLabel}
		</Button>
	{/if}
</div>
