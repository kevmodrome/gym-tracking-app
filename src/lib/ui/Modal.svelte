<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import XIcon from '$lib/components/XIcon.svelte';

	type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

	interface ModalProps {
		open: boolean;
		title: string;
		size?: ModalSize;
		closeOnBackdrop?: boolean;
		closeOnEscape?: boolean;
		showCloseButton?: boolean;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
	}

	let {
		open = false,
		title,
		size = 'md',
		closeOnBackdrop = true,
		closeOnEscape = true,
		showCloseButton = true,
		onclose,
		children,
		footer
	}: ModalProps = $props();

	const sizeClasses: Record<ModalSize, string> = {
		sm: 'max-w-md',
		md: 'max-w-2xl',
		lg: 'max-w-4xl',
		xl: 'max-w-6xl',
		full: 'max-w-[95vw]'
	};

	function handleBackdropClick() {
		if (closeOnBackdrop) {
			onclose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && closeOnEscape) {
			onclose();
		}
	}

	function handleContainerClick(e: MouseEvent) {
		e.stopPropagation();
	}

	function handleContainerKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			if (closeOnEscape) {
				onclose();
			}
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="presentation"
		transition:fade={{ duration: 150 }}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
			tabindex="-1"
			class="bg-surface rounded-xl border border-border shadow-2xl {sizeClasses[size]} w-full max-h-[90vh] overflow-y-auto"
			onclick={handleContainerClick}
			onkeydown={handleContainerKeydown}
			transition:scale={{ duration: 150, start: 0.95, easing: cubicOut }}
		>
			<div class="p-6 border-b border-border">
				<div class="flex items-center justify-between">
					<h2 id="modal-title" class="text-2xl font-bold font-display text-text-primary">{title}</h2>
					{#if showCloseButton}
						<button
							onclick={onclose}
							class="p-2 hover:bg-surface-elevated rounded-full transition-colors"
							type="button"
							aria-label="Close modal"
						>
							<XIcon class="w-6 h-6 text-text-secondary hover:text-text-primary" />
						</button>
					{/if}
				</div>
			</div>
			<div class="p-6">
				{@render children()}
			</div>
			{#if footer}
				<div class="p-6 border-t border-border bg-surface-elevated/50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
