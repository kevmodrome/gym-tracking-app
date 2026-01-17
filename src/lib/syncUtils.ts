import { db } from './db';
import type { SyncQueueItem, SyncStatus, SyncResult, SyncProgress } from './types';

export class SyncManager {
	private syncInProgress = false;
	private retryAttempts = 3;
	private baseRetryDelay = 1000;

	constructor() {
		this.setupNetworkListeners();
	}

	private setupNetworkListeners(): void {
		if (typeof window !== 'undefined') {
			window.addEventListener('online', () => {
				this.scheduleSync();
			});
		}
	}

	async addToSyncQueue(
		targetType: SyncQueueItem['targetType'],
		targetId: string,
		operation: SyncQueueItem['operation'],
		data: unknown
	): Promise<void> {
		const item: SyncQueueItem = {
			id: crypto.randomUUID(),
			targetType,
			targetId,
			operation,
			data,
			timestamp: new Date().toISOString(),
			retries: 0,
			status: 'pending'
		};

		await db.syncQueue.add(item);
		await this.scheduleSync();
	}

	async getPendingItems(): Promise<SyncQueueItem[]> {
		return await db.syncQueue.where('status').equals('pending').toArray();
	}

	async getSyncQueueCount(): Promise<number> {
		return await db.syncQueue.where('status').equals('pending').count();
	}

	async scheduleSync(): Promise<void> {
		if (this.syncInProgress || typeof navigator === 'undefined' || !navigator.onLine) {
			return;
		}

		this.syncInProgress = true;
		await new Promise((resolve) => setTimeout(resolve, 100));
		await this.sync();
		this.syncInProgress = false;
	}

	async sync(onProgress?: (progress: SyncProgress) => void): Promise<SyncResult> {
		const startTime = Date.now();
		let itemsProcessed = 0;
		let itemsFailed = 0;
		let itemsSkipped = 0;

		try {
			const pendingItems = await this.getPendingItems();
			const total = pendingItems.length;

			if (total === 0) {
				return {
					success: true,
					itemsProcessed: 0,
					itemsFailed: 0,
					itemsSkipped: 0,
					duration: 0,
					message: 'No items to sync'
				};
			}

			if (!navigator.onLine) {
				return {
					success: false,
					itemsProcessed: 0,
					itemsFailed: total,
					itemsSkipped: 0,
					duration: 0,
					message: 'Offline - sync will resume when connected'
				};
			}

			for (let i = 0; i < pendingItems.length; i++) {
				const item = pendingItems[i];
				onProgress?.({
					current: i,
					total,
					stage: `Syncing ${item.targetType}...`
				});

				const success = await this.syncItem(item);

				if (success) {
					itemsProcessed++;
					await db.syncQueue.update(item.id, { status: 'synced' });
				} else {
					itemsFailed++;
					const newRetries = item.retries + 1;
					const shouldRetry = newRetries < this.retryAttempts;
					
					await db.syncQueue.update(item.id, {
						retries: newRetries,
						lastRetryTime: new Date().toISOString(),
						status: shouldRetry ? 'pending' : 'failed'
					});
				}
			}

			await this.cleanupSyncedItems();

			const duration = Date.now() - startTime;
			const message =
				itemsFailed === 0
					? `Successfully synced ${itemsProcessed} item${itemsProcessed !== 1 ? 's' : ''}`
					: `Synced ${itemsProcessed} item${itemsProcessed !== 1 ? 's' : ''}, ${itemsFailed} failed`;

			return {
				success: itemsFailed === 0,
				itemsProcessed,
				itemsFailed,
				itemsSkipped,
				duration,
				message
			};
		} catch (error) {
			return {
				success: false,
				itemsProcessed,
				itemsFailed,
				itemsSkipped,
				duration: Date.now() - startTime,
				message: error instanceof Error ? error.message : 'Unknown sync error'
			};
		}
	}

	private async syncItem(item: SyncQueueItem): Promise<boolean> {
		try {
			await this.simulateApiCall(item);
			return true;
		} catch (error) {
			await this.handleSyncError(item, error);
			return false;
		}
	}

	private async simulateApiCall(item: SyncQueueItem): Promise<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				if (item.retries >= this.retryAttempts) {
					reject(new Error('Max retries exceeded'));
				} else {
					resolve();
				}
			}, 500 + Math.random() * 500);
		});
	}

	private async handleSyncError(item: SyncQueueItem, error: unknown): Promise<void> {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		await db.syncQueue.update(item.id, {
			error: errorMessage
		});
	}

	private async cleanupSyncedItems(): Promise<void> {
		const syncedItems = await db.syncQueue.where('status').equals('synced').toArray();
		const oldItems = syncedItems.filter(
			(item) =>
				new Date(item.timestamp).getTime() <
				Date.now() - 24 * 60 * 60 * 1000
		);
		const idsToDelete = oldItems.map((item) => item.id);
		if (idsToDelete.length > 0) {
			await db.syncQueue.bulkDelete(idsToDelete);
		}
	}

	async clearSyncQueue(): Promise<number> {
		const count = await db.syncQueue.count();
		await db.syncQueue.clear();
		return count;
	}

	async getLastSyncTimestamp(): Promise<string | null> {
		const items = await db.syncQueue.orderBy('timestamp').last();
		return items?.timestamp || null;
	}

	isOnline(): boolean {
		return typeof navigator !== 'undefined' && navigator.onLine;
	}

	getSyncStatus(): SyncStatus {
		if (!this.isOnline()) return 'failed';
		if (this.syncInProgress) return 'syncing';
		return 'synced';
	}
}

export const syncManager = new SyncManager();

export function getRetryDelay(retryCount: number): number {
	const baseRetryDelay = 1000;
	return Math.min(baseRetryDelay * Math.pow(2, retryCount), 30000);
}

export function formatSyncDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
	return `${minutes}m`;
}

export function formatSyncMessage(result: SyncResult): string {
	if (result.itemsFailed === 0) {
		return result.message;
	}
	const retryMessage = result.itemsFailed > 1 ? 'Retries will continue automatically.' : 'Will retry automatically.';
	return `${result.message} ${retryMessage}`;
}
