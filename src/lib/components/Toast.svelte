<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { toastStore, type Toast } from '$lib/stores/toast.svelte';
	import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-svelte';

	const icons = {
		success: CheckCircle,
		error: XCircle,
		warning: AlertTriangle,
		info: Info
	};

	const styles = {
		success: 'bg-surface border-success/30 text-text-primary',
		error: 'bg-surface border-danger/30 text-text-primary',
		warning: 'bg-surface border-warning/30 text-text-primary',
		info: 'bg-surface border-secondary/30 text-text-primary'
	};

	const iconColors = {
		success: 'text-success',
		error: 'text-danger',
		warning: 'text-warning',
		info: 'text-secondary'
	};
</script>

{#if toastStore.toasts.length > 0}
	<div class="toast-container fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto z-[100] flex flex-col items-end gap-2 pointer-events-none md:max-w-md">
		{#each toastStore.toasts as toast (toast.id)}
			<div
				class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm {styles[toast.type]}"
				role="alert"
				in:fly={{ x: 100, duration: 200 }}
				out:fade={{ duration: 150 }}
			>
				<svelte:component this={icons[toast.type]} class="w-5 h-5 flex-shrink-0 {iconColors[toast.type]}" />
				<span class="text-sm font-medium flex-1">{toast.message}</span>
				<button
					onclick={() => toastStore.remove(toast.id)}
					class="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors text-text-muted hover:text-text-primary"
					aria-label="Dismiss notification"
				>
					<X class="w-4 h-4" />
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	/* Keep toast above everything during view transitions */
	.toast-container {
		view-transition-name: toast;
	}
</style>

