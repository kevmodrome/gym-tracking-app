<script lang="ts">
	import { toastStore, type Toast } from '$lib/stores/toast';
	import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-svelte';

	const icons = {
		success: CheckCircle,
		error: XCircle,
		warning: AlertTriangle,
		info: Info
	};

	const styles = {
		success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200',
		error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200',
		warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200',
		info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200'
	};

	const iconColors = {
		success: 'text-green-500 dark:text-green-400',
		error: 'text-red-500 dark:text-red-400',
		warning: 'text-amber-500 dark:text-amber-400',
		info: 'text-blue-500 dark:text-blue-400'
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
					class="flex-shrink-0 p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
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
