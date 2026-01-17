<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';

	type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
	type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

	interface ButtonProps {
		variant?: ButtonVariant;
		size?: ButtonSize;
		disabled?: boolean;
		loading?: boolean;
		fullWidth?: boolean;
		type?: 'button' | 'submit' | 'reset';
		href?: string;
		class?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		fullWidth = false,
		type = 'button',
		href,
		class: className = '',
		onclick,
		children
	}: ButtonProps = $props();

	const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

	const variantStyles: Record<ButtonVariant, string> = {
		primary: 'bg-blue-600 text-white hover:bg-blue-700',
		secondary: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
		danger: 'bg-red-600 text-white hover:bg-red-700',
		ghost: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
		success: 'bg-green-600 text-white hover:bg-green-700'
	};

	const sizeStyles: Record<ButtonSize, string> = {
		sm: 'px-3 py-1.5 text-sm min-h-[36px]',
		md: 'px-4 py-3 text-base min-h-[44px]',
		lg: 'px-6 py-4 text-lg min-h-[52px]',
		icon: 'p-2 min-w-[44px] min-h-[44px]'
	};

	const classes = $derived(
		[baseStyles, variantStyles[variant], sizeStyles[size], fullWidth && 'w-full', className]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if href && !disabled}
	<a {href} class={classes}>
		{#if loading}
			<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
		{/if}
		{@render children()}
	</a>
{:else}
	<button
		{type}
		{disabled}
		class={classes}
		{onclick}
	>
		{#if loading}
			<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
		{/if}
		{@render children()}
	</button>
{/if}
