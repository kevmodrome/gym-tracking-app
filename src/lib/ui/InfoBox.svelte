<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';

	type InfoBoxType = 'info' | 'success' | 'warning' | 'error';

	interface InfoBoxProps {
		type?: InfoBoxType;
		title?: string;
		dismissible?: boolean;
		onclose?: () => void;
		class?: string;
		icon?: Snippet;
		children: Snippet;
	}

	let {
		type = 'info',
		title,
		dismissible = false,
		onclose,
		class: className = '',
		icon,
		children
	}: InfoBoxProps = $props();

	const typeStyles: Record<
		InfoBoxType,
		{ bg: string; border: string; text: string }
	> = {
		info: {
			bg: 'bg-secondary/10',
			border: 'border-l-4 border-secondary',
			text: 'text-text-primary'
		},
		success: {
			bg: 'bg-success/10',
			border: 'border-l-4 border-success',
			text: 'text-text-primary'
		},
		warning: {
			bg: 'bg-warning/10',
			border: 'border-l-4 border-warning',
			text: 'text-text-primary'
		},
		error: {
			bg: 'bg-danger/10',
			border: 'border-l-4 border-danger',
			text: 'text-text-primary'
		}
	};

	const styles = $derived(typeStyles[type]);
</script>

<div class="{styles.bg} {styles.border} rounded-lg p-3 sm:p-4 {className}">
	<div class="flex items-start justify-between gap-2">
		<div class="flex-1">
			{#if title}
				<h3 class="font-semibold {styles.text} mb-2 text-sm sm:text-base flex items-center gap-2 [&_svg]:w-4 [&_svg]:h-4">
					{#if icon}
						{@render icon()}
					{/if}
					{title}
				</h3>
			{/if}
			<div class="{styles.text} text-sm sm:text-base">
				{@render children()}
			</div>
		</div>
		{#if dismissible && onclose}
			<button
				onclick={onclose}
				class="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
				type="button"
				aria-label="Dismiss"
			>
				<X class="w-4 h-4 text-text-secondary" />
			</button>
		{/if}
	</div>
</div>
