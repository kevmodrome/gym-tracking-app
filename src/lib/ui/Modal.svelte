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
		fullScreenMobile?: boolean;
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
		fullScreenMobile = false,
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
		class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 {fullScreenMobile ? 'p-0 sm:p-4' : 'p-4'}"
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
			class="bg-surface shadow-2xl {sizeClasses[size]} w-full flex flex-col {fullScreenMobile ? 'h-full sm:h-auto sm:max-h-[90vh] sm:rounded-xl sm:border sm:border-border' : 'max-h-[90vh] rounded-xl border border-border'}"
			onclick={handleContainerClick}
			onkeydown={handleContainerKeydown}
			transition:scale={{ duration: 150, start: 0.95, easing: cubicOut }}
		>
			<div class="border-b border-border flex-shrink-0 {fullScreenMobile ? 'p-3 sm:p-6' : 'p-6'}">
				<div class="flex items-center justify-between">
					<h2 id="modal-title" class="font-bold font-display text-text-primary {fullScreenMobile ? 'text-lg sm:text-2xl' : 'text-2xl'}">{title}</h2>
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
			<div class="overflow-y-auto flex-1 {fullScreenMobile ? 'p-3 sm:p-6' : 'p-6'}">
				{@render children()}
			</div>
			{#if footer}
				<div class="border-t border-border bg-surface-elevated/50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 flex-shrink-0 {fullScreenMobile ? 'p-3 sm:p-6' : 'p-6'}">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
