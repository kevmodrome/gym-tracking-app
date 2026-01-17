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

	const baseClasses = 'bg-white rounded-lg shadow-md';
	const hoverClasses = hoverable ? 'hover:shadow-lg transition-shadow' : '';
</script>

<div class="{baseClasses} {hoverClasses} {className}">
	{#if header}
		<div class="border-b border-gray-200 {paddingClasses[padding]}">
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
		<div class="border-t border-gray-200 {paddingClasses[padding]}">
			{@render footer()}
		</div>
	{/if}
</div>
