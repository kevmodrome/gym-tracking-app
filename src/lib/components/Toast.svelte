<script lang="ts">
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
	<div class="fixed top-4 left-4 right-4 z-[100] flex flex-col items-center gap-2 pointer-events-none md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md">
		{#each toastStore.toasts as toast}
			<div
				class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-top-2 fade-in {styles[toast.type]}"
				role="alert"
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
	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-in {
		animation: slideIn 0.3s ease-out;
	}
</style>
