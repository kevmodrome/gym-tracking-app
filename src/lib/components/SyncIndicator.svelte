<script lang="ts">
	import { syncManager } from '$lib/syncUtils';
	import { syncKey, isSyncing as isSyncingStore } from '$lib/syncService';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { onMount } from 'svelte';
	import { Cloud, CloudOff, RefreshCw } from 'lucide-svelte';

	let { position = 'fixed' } = $props();
	let syncStatus = $state<'synced' | 'syncing' | 'failed' | 'disabled'>('disabled');
	let isLoading = $state(false);
	// Initialize to actual online status to prevent false "back online" detection on mount
	const initialOnlineStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;
	let isOnline = $state(initialOnlineStatus);
	let wasOnline = $state(initialOnlineStatus);
	let hasSyncKey = $state(false);
	let hasMounted = $state(false);
	let showPulse = $state(false);

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
			clearInterval(interval);
			window.removeEventListener('online', updateStatus);
			window.removeEventListener('offline', updateStatus);
		};
	});

	function triggerPulse() {
		showPulse = true;
		setTimeout(() => {
			showPulse = false;
		}, 1000);
	}

	function updateStatus() {
		const previousStatus = syncStatus;
		wasOnline = isOnline;
		isOnline = syncManager.isOnline();

		if (!hasSyncKey) {
			syncStatus = 'disabled';
		} else if (!isOnline) {
			syncStatus = 'failed';
		} else if (isLoading) {
			syncStatus = 'syncing';
		} else {
			syncStatus = 'synced';
			// Auto-sync when coming back online (only after initial mount)
			if (hasMounted && !wasOnline && hasSyncKey) {
				handleManualSync(true);
			}
		}

		// Trigger pulse animation when status changes (after initial mount)
		if (hasMounted && syncStatus !== previousStatus) {
			triggerPulse();
		}

		hasMounted = true;
	}

	async function handleManualSync(isAutoSync = false) {
		if (!hasSyncKey || !isOnline) return;

		// Only show toasts for manual sync, not auto-sync
		if (!isAutoSync) {
			toastStore.showInfo('Syncing your data...');
		}

		const result = await syncManager.sync((progress) => {
			console.log(`Syncing... ${progress.current}/${progress.total} - ${progress.stage}`);
		});

		if (result.success) {
			// Only show success toast for manual sync
			if (!isAutoSync) {
				toastStore.showSuccess(result.message, 3000);
			}
		} else {
			// Always show errors
			toastStore.showError(result.message, 4000);
		}
	}
</script>

{#if position !== 'fixed'}
	<div class="flex items-center gap-2 h-5 min-w-[5.5rem] {showPulse ? 'animate-pulse' : ''}">
		{#if syncStatus === 'disabled'}
			<CloudOff class="w-4 h-4 text-text-muted flex-shrink-0" />
			<span class="text-xs text-text-muted">Sync disabled</span>
		{:else if !isOnline}
			<CloudOff class="w-4 h-4 text-danger flex-shrink-0" />
			<span class="text-xs text-danger">Offline</span>
		{:else if syncStatus === 'syncing' || isLoading}
			<RefreshCw class="w-4 h-4 text-secondary animate-spin flex-shrink-0" />
			<span class="text-xs text-secondary">Syncing...</span>
		{:else}
			<Cloud class="w-4 h-4 text-success flex-shrink-0" />
			<span class="text-xs text-success">Synced</span>
		{/if}
	</div>
{/if}
