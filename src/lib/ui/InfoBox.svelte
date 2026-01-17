<script lang="ts">
	import type { Snippet } from 'svelte';
	import XIcon from '$lib/components/XIcon.svelte';

	type InfoBoxType = 'info' | 'success' | 'warning' | 'error';

	interface InfoBoxProps {
		type?: InfoBoxType;
		title?: string;
		dismissible?: boolean;
		onclose?: () => void;
		class?: string;
		children: Snippet;
	}

	let {
		type = 'info',
		title,
		dismissible = false,
		onclose,
		class: className = '',
		children
	}: InfoBoxProps = $props();

	const typeStyles: Record<InfoBoxType, { bg: string; border: string; text: string; icon: string }> = {
		info: {
			bg: 'bg-blue-50',
			border: 'border-blue-200',
			text: 'text-blue-800',
			icon: 'ℹ️'
		},
		success: {
			bg: 'bg-green-50',
			border: 'border-green-200',
			text: 'text-green-800',
			icon: '✅'
		},
		warning: {
			bg: 'bg-amber-50',
			border: 'border-amber-200',
			text: 'text-amber-800',
			icon: '⚠️'
		},
		error: {
			bg: 'bg-red-50',
			border: 'border-red-200',
			text: 'text-red-800',
			icon: '❌'
		}
	};

	const styles = $derived(typeStyles[type]);
</script>

<div class="{styles.bg} border {styles.border} rounded-lg p-3 sm:p-4 {className}">
	<div class="flex items-start justify-between gap-2">
		<div class="flex-1">
			{#if title}
				<h3 class="font-semibold {styles.text} mb-2 text-sm sm:text-base flex items-center gap-2">
					<span>{styles.icon}</span>
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
				class="p-1 rounded hover:bg-black/5 transition-colors flex-shrink-0"
				type="button"
				aria-label="Dismiss"
			>
				<XIcon class="w-4 h-4 {styles.text}" />
			</button>
		{/if}
	</div>
</div>
