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
		class="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200 bg-white dark:bg-gray-800 {syncQueueCount > 0 || !isOnline ? 'border' : ''} {isOnline ? 'border-gray-300' : 'border-red-300'}"
	>
		{#if !isOnline}
			<CloudOff class="w-5 h-5 text-red-500" />
			<span class="text-sm font-medium text-red-600">Offline</span>
		{:else if syncStatus === 'syncing' || isLoading}
			<RefreshCw class="w-5 h-5 text-blue-500 animate-spin" />
			<span class="text-sm font-medium text-blue-600">Syncing...</span>
		{:else if syncQueueCount > 0}
			<AlertCircle class="w-5 h-5 text-amber-500" />
			<span class="text-sm font-medium text-amber-600"
				>{syncQueueCount} pending</span
			>
			<button
				onclick={handleManualSync}
				class="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				disabled={isLoading}
				aria-label="Force sync now"
			>
				Sync
			</button>
		{:else}
			<Cloud class="w-5 h-5 text-green-500" />
			<span class="text-sm font-medium text-green-600">Synced</span>
		{/if}
	</div>
{:else}
	<div class="flex items-center gap-2">
		{#if !isOnline}
			<CloudOff class="w-4 h-4 text-red-500" />
			<span class="text-xs text-red-600">Offline</span>
		{:else if syncStatus === 'syncing' || isLoading}
			<RefreshCw class="w-4 h-4 text-blue-500 animate-spin" />
			<span class="text-xs text-blue-600">Syncing...</span>
		{:else if syncQueueCount > 0}
			<AlertCircle class="w-4 h-4 text-amber-500" />
			<button
				onclick={handleManualSync}
				class="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
				disabled={isLoading}
				aria-label="Sync pending items"
			>
				<span>{syncQueueCount} pending</span>
				<RefreshCw class="w-3 h-3" />
			</button>
		{:else}
			<Cloud class="w-4 h-4 text-green-500" />
			<span class="text-xs text-green-600">Synced</span>
		{/if}
	</div>
{/if}
