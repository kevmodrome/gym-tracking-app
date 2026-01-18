<script lang="ts">
	import { syncManager, formatLastSyncTime } from '$lib/syncUtils';
	import {
		syncKey,
		isSyncing as isSyncingStore,
		lastSyncTime,
		isSyncEnabled
	} from '$lib/syncService';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { onMount } from 'svelte';
	import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-svelte';

	let { position = 'fixed' } = $props();
	let syncStatus = $state<'synced' | 'syncing' | 'failed' | 'disabled'>('disabled');
	let isLoading = $state(false);
	let isOnline = $state(false);
	let wasOnline = $state(true);
	let hasSyncKey = $state(false);
	let currentLastSyncTime = $state<number | null>(null);

	onMount(() => {
		// Subscribe to sync stores
		const unsubKey = syncKey.subscribe((value) => {
			hasSyncKey = value !== null;
			updateStatus();
		});
		const unsubSyncing = isSyncingStore.subscribe((value) => {
			isLoading = value;
			updateStatus();
		});
		const unsubTime = lastSyncTime.subscribe((value) => {
			currentLastSyncTime = value;
		});

		updateStatus();
		window.addEventListener('online', updateStatus);
		window.addEventListener('offline', updateStatus);

		// Periodic status check
		const interval = setInterval(() => {
			updateStatus();
		}, 5000);

		return () => {
			unsubKey();
			unsubSyncing();
			unsubTime();
			clearInterval(interval);
			window.removeEventListener('online', updateStatus);
			window.removeEventListener('offline', updateStatus);
		};
	});

	function updateStatus() {
		wasOnline = isOnline;
		isOnline = syncManager.isOnline();

		if (!hasSyncKey) {
			syncStatus = 'disabled';
		} else if (!isOnline) {
			syncStatus = 'failed';
			if (wasOnline && hasSyncKey) {
				toastStore.showInfo('You are now offline. Changes will sync when connection is restored.', 4000);
			}
		} else if (isLoading) {
			syncStatus = 'syncing';
		} else {
			syncStatus = 'synced';
			if (!wasOnline && hasSyncKey) {
				toastStore.showSuccess('You are back online!', 3000);
				// Auto-sync when coming back online
				handleManualSync();
			}
		}
	}

	async function handleManualSync() {
		if (!hasSyncKey || !isOnline) return;

		toastStore.showInfo('Syncing your data...');
		const result = await syncManager.sync((progress) => {
			console.log(`Syncing... ${progress.current}/${progress.total} - ${progress.stage}`);
		});

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
		{#if syncStatus === 'disabled'}
			<CloudOff class="w-5 h-5 text-text-muted" />
			<span class="text-sm font-medium text-text-muted">Sync disabled</span>
		{:else if !isOnline}
			<CloudOff class="w-5 h-5 text-danger" />
			<span class="text-sm font-medium text-danger">Offline</span>
		{:else if syncStatus === 'syncing' || isLoading}
			<RefreshCw class="w-5 h-5 text-secondary animate-spin" />
			<span class="text-sm font-medium text-secondary">Syncing...</span>
		{:else}
			<Cloud class="w-5 h-5 text-success" />
			<span class="text-sm font-medium text-success">Synced</span>
		{/if}
	</div>
{:else}
	<div class="flex items-center gap-2">
		{#if syncStatus === 'disabled'}
			<CloudOff class="w-4 h-4 text-text-muted" />
			<span class="text-xs text-text-muted">Sync disabled</span>
		{:else if !isOnline}
			<CloudOff class="w-4 h-4 text-danger" />
			<span class="text-xs text-danger">Offline</span>
		{:else if syncStatus === 'syncing' || isLoading}
			<RefreshCw class="w-4 h-4 text-secondary animate-spin" />
			<span class="text-xs text-secondary">Syncing...</span>
		{:else}
			<Cloud class="w-4 h-4 text-success" />
			<span class="text-xs text-success">Synced</span>
		{/if}
	</div>
{/if}
