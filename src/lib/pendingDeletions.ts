import { writable, get } from 'svelte/store';

export type TableName = 'exercises' | 'workouts' | 'sessions' | 'personalRecords';

export interface PendingDeletion {
	table: TableName;
	record: Record<string, unknown>;
	deletedAt: number;
}

const STORAGE_KEY = 'gym-app-pending-deletions';

// Load initial state from localStorage
function loadPendingDeletions(): PendingDeletion[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored ? JSON.parse(stored) : [];
	} catch {
		return [];
	}
}

// Create the store
export const pendingDeletions = writable<PendingDeletion[]>(loadPendingDeletions());

// Persist to localStorage on changes
pendingDeletions.subscribe((value) => {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	}
});

// Add a pending deletion
export function addPendingDeletion(table: TableName, record: Record<string, unknown>): void {
	pendingDeletions.update((deletions) => [
		...deletions,
		{
			table,
			record,
			deletedAt: Date.now()
		}
	]);
}

// Get pending deletions by table
export function getPendingDeletionsByTable(table: TableName): PendingDeletion[] {
	return get(pendingDeletions).filter((d) => d.table === table);
}

// Get all pending deletions
export function getAllPendingDeletions(): PendingDeletion[] {
	return get(pendingDeletions);
}

// Clear all pending deletions (call after successful sync)
export function clearPendingDeletions(): void {
	pendingDeletions.set([]);
}
