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
	// Initialize to actual online status to prevent false "back online" detection on mount
	const initialOnlineStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;
	let isOnline = $state(initialOnlineStatus);
	let wasOnline = $state(initialOnlineStatus);
	let hasSyncKey = $state(false);
	let currentLastSyncTime = $state<number | null>(null);
	let hasMounted = $state(false);
	let showPulse = $state(false);
	let showIndicator = $state(true);
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;

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
			if (hideTimeout) clearTimeout(hideTimeout);
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

		// Manage indicator visibility
		if (hideTimeout) {
			clearTimeout(hideTimeout);
			hideTimeout = null;
		}

		if (syncStatus === 'disabled') {
			// Hide immediately when sync is disabled
			showIndicator = false;
		} else if (syncStatus === 'synced') {
			// Show briefly then fade out after 3 seconds
			showIndicator = true;
			hideTimeout = setTimeout(() => {
				showIndicator = false;
			}, 3000);
		} else {
			// Keep visible for syncing and offline states
			showIndicator = true;
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

{#if position === 'fixed'}
	<div
		class="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-300 bg-surface border border-border {showPulse ? 'animate-pulse ring-2 ring-secondary/50' : ''} {showIndicator ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}"
	>
		{#if !isOnline}
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
	<div class="flex items-center gap-2 {showPulse ? 'animate-pulse' : ''}">
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
