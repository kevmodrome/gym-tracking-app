<script lang="ts">
	import { syncManager } from '$lib/syncUtils';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { onMount } from 'svelte';
	import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-svelte';

	let { position = 'fixed' } = $props();
	let syncQueueCount = $state(0);
	let syncStatus = $state('synced');
	let isLoading = $state(false);
	let isOnline = $state(false);
	let wasOnline = $state(true);

	onMount(() => {
		updateStatus();
		window.addEventListener('online', updateStatus);
		window.addEventListener('offline', updateStatus);

		const interval = setInterval(async () => {
			syncQueueCount = await syncManager.getSyncQueueCount();
			if (syncStatus === 'syncing') {
				updateStatus();
			}
		}, 2000);

		return () => {
			clearInterval(interval);
			window.removeEventListener('online', updateStatus);
			window.removeEventListener('offline', updateStatus);
		};
	});

	async function scheduleSync() {
		if (isOnline && syncQueueCount > 0) {
			handleManualSync();
		}
	}

	async function updateStatus() {
		wasOnline = isOnline;
		isOnline = syncManager.isOnline();
		if (!isOnline) {
			syncStatus = 'failed';
			if (wasOnline) {
				toastStore.showInfo('You are now offline. Changes will sync when connection is restored.', 4000);
			}
		} else {
			syncStatus = syncManager.getSyncStatus();
			if (!wasOnline) {
				toastStore.showSuccess('You are back online!', 3000);
				scheduleSync();
			}
		}
		syncQueueCount = await syncManager.getSyncQueueCount();
	}

	async function handleManualSync() {
		isLoading = true;
		toastStore.showInfo('Syncing your data...');
		const result = await syncManager.sync((progress) => {
			console.log(`Syncing... ${progress.current}/${progress.total} - ${progress.stage}`);
		});
		isLoading = false;
		syncQueueCount = await syncManager.getSyncQueueCount();
		syncStatus = result.success ? 'synced' : 'failed';

		if (result.success) {
			toastStore.showSuccess(result.message, 3000);
		} else {
			toastStore.showError(result.message, 4000);
		}
	}
</script>

{#if position === 'fixed'}
	<div
		class="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200 bg-surface border border-border"
	>
		{#if !isOnline}
			<CloudOff class="w-5 h-5 text-danger" />
			<span class="text-sm font-medium text-danger">Offline</span>
		{:else if syncStatus === 'syncing' || isLoading}
			<RefreshCw class="w-5 h-5 text-secondary animate-spin" />
			<span class="text-sm font-medium text-secondary">Syncing...</span>
		{:else if syncQueueCount > 0}
			<AlertCircle class="w-5 h-5 text-warning" />
			<span class="text-sm font-medium text-warning"
				>{syncQueueCount} pending</span
			>
			<button
				onclick={handleManualSync}
				class="ml-2 px-2 py-0.5 text-xs font-semibold text-bg bg-accent rounded hover:bg-accent-muted disabled:opacity-50 disabled:cursor-not-allowed"
				disabled={isLoading}
				aria-label="Force sync now"
			>
				Sync
			</button>
		{:else}
			<Cloud class="w-5 h-5 text-success" />
			<span class="text-sm font-medium text-success">Synced</span>
		{/if}
	</div>
{:else}
	<div class="flex items-center gap-2">
		{#if !isOnline}
			<CloudOff class="w-4 h-4 text-danger" />
			<span class="text-xs text-danger">Offline</span>
		{:else if syncStatus === 'syncing' || isLoading}
			<RefreshCw class="w-4 h-4 text-secondary animate-spin" />
			<span class="text-xs text-secondary">Syncing...</span>
		{:else if syncQueueCount > 0}
			<AlertCircle class="w-4 h-4 text-warning" />
			<button
				onclick={handleManualSync}
				class="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-warning bg-warning/20 rounded hover:bg-warning/30 disabled:opacity-50 disabled:cursor-not-allowed"
				disabled={isLoading}
				aria-label="Sync pending items"
			>
				<span>{syncQueueCount} pending</span>
				<RefreshCw class="w-3 h-3" />
			</button>
		{:else}
			<Cloud class="w-4 h-4 text-success" />
			<span class="text-xs text-success">Synced</span>
		{/if}
	</div>
{/if}
