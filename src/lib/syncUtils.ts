import { get } from 'svelte/store';
import { syncData, isSyncing, syncKey, lastSyncTime, isSyncEnabled } from './syncService';
import type { SyncStatus, SyncResult, SyncProgress } from './types';

export class SyncManager {
	private syncInProgress = false;
	private autoSyncInterval: ReturnType<typeof setInterval> | null = null;
	private readonly AUTO_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

	constructor() {
		this.setupNetworkListeners();
		this.setupAutoSync();
	}

	private setupNetworkListeners(): void {
		if (typeof window !== 'undefined') {
			window.addEventListener('online', () => {
				// Sync when coming back online
				if (isSyncEnabled()) {
					this.scheduleSync();
				}
			});
		}
	}

	private setupAutoSync(): void {
		if (typeof window !== 'undefined') {
			// Auto-sync every 5 minutes if sync is enabled
			this.autoSyncInterval = setInterval(() => {
				if (isSyncEnabled() && this.isOnline() && !this.syncInProgress) {
					this.scheduleSync();
				}
			}, this.AUTO_SYNC_INTERVAL);
		}
	}

	async scheduleSync(): Promise<void> {
		if (this.syncInProgress || !this.isOnline() || !isSyncEnabled()) {
			return;
		}

		this.syncInProgress = true;
		// Small delay to batch rapid changes
		await new Promise((resolve) => setTimeout(resolve, 100));
		await this.sync();
		this.syncInProgress = false;
	}

	async sync(onProgress?: (progress: SyncProgress) => void): Promise<SyncResult> {
		const startTime = Date.now();

		if (!isSyncEnabled()) {
			return {
				success: false,
				itemsProcessed: 0,
				itemsFailed: 0,
				itemsSkipped: 0,
				duration: 0,
				message: 'Sync not enabled - generate or enter a sync key first'
			};
		}

		if (!this.isOnline()) {
			return {
				success: false,
				itemsProcessed: 0,
				itemsFailed: 0,
				itemsSkipped: 0,
				duration: 0,
				message: 'Offline - sync will resume when connected'
			};
		}

		onProgress?.({
			current: 0,
			total: 1,
			stage: 'Syncing data...'
		});

		try {
			const result = await syncData();
			const duration = Date.now() - startTime;

			onProgress?.({
				current: 1,
				total: 1,
				stage: 'Complete'
			});

			if (result.success) {
				return {
					success: true,
					itemsProcessed: 1,
					itemsFailed: 0,
					itemsSkipped: 0,
					duration,
					message: 'Successfully synced all data'
				};
			} else {
				return {
					success: false,
					itemsProcessed: 0,
					itemsFailed: 1,
					itemsSkipped: 0,
					duration,
					message: result.error || 'Sync failed'
				};
			}
		} catch (error) {
			return {
				success: false,
				itemsProcessed: 0,
				itemsFailed: 1,
				itemsSkipped: 0,
				duration: Date.now() - startTime,
				message: error instanceof Error ? error.message : 'Unknown sync error'
			};
		}
	}

	isOnline(): boolean {
		return typeof navigator !== 'undefined' && navigator.onLine;
	}

	getSyncStatus(): SyncStatus {
		if (!this.isOnline()) return 'failed';
		if (get(isSyncing)) return 'syncing';
		if (!isSyncEnabled()) return 'synced'; // No sync key = nothing to sync
		return 'synced';
	}

	getLastSyncTime(): number | null {
		return get(lastSyncTime);
	}

	hasSyncKey(): boolean {
		return isSyncEnabled();
	}

	destroy(): void {
		if (this.autoSyncInterval) {
			clearInterval(this.autoSyncInterval);
			this.autoSyncInterval = null;
		}
	}
}

export const syncManager = new SyncManager();

export function formatSyncDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
	return `${minutes}m`;
}

export function formatSyncMessage(result: SyncResult): string {
	return result.message;
}

export function formatLastSyncTime(timestamp: number | null): string {
	if (!timestamp) return 'Never';

	const now = Date.now();
	const diff = now - timestamp;

	if (diff < 60000) return 'Just now';
	if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
	if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
	return new Date(timestamp).toLocaleDateString();
}
