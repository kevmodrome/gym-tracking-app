<script lang="ts">
	import type { Snippet } from 'svelte';

	type CardPadding = 'none' | 'sm' | 'md' | 'lg';

	interface CardProps {
		hoverable?: boolean;
		padding?: CardPadding;
		class?: string;
		children: Snippet;
		header?: Snippet;
		footer?: Snippet;
	}

	let {
		hoverable = false,
		padding = 'md',
		class: className = '',
		children,
		header,
		footer
	}: CardProps = $props();

	const paddingClasses: Record<CardPadding, string> = {
		none: '',
		sm: 'p-3',
		md: 'p-5',
		lg: 'p-6'
	};

	const baseClasses = 'bg-surface rounded-xl border border-border';
	const hoverClasses = hoverable ? 'hover:border-border-active hover:bg-surface-elevated transition-all duration-200' : '';
</script>

<div class="{baseClasses} {hoverClasses} {className}">
	{#if header}
		<div class="border-b border-border {paddingClasses[padding]}">
			{@render header()}
		</div>
		<div class={paddingClasses[padding]}>
			{@render children()}
		</div>
	{:else}
		<div class={paddingClasses[padding]}>
			{@render children()}
		</div>
	{/if}
	{#if footer}
		<div class="border-t border-border {paddingClasses[padding]}">
			{@render footer()}
		</div>
	{/if}
</div>
