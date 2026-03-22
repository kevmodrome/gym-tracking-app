const DEFAULT_DB_NAME = 'gym-recording-app';
const INVITE_STORAGE_KEY = 'gym-app-invite';
const RESET_DB_NAME_KEY = 'gym-app-reset-db-name';
const APP_STORAGE_PREFIXES = ['gym-app', 'gym-progress', 'progress-'];
const APP_STORAGE_KEYS = ['pwa-install-dismissed'];

interface StoredInvite {
	dbName?: string;
}

export function getInviteDbName(): string {
	if (typeof localStorage === 'undefined') return DEFAULT_DB_NAME;

	const raw = localStorage.getItem(INVITE_STORAGE_KEY);
	if (!raw) return DEFAULT_DB_NAME;

	try {
		const invite = JSON.parse(raw) as StoredInvite;
		return invite.dbName || DEFAULT_DB_NAME;
	} catch {
		return DEFAULT_DB_NAME;
	}
}

export function clearAppLocalState(): void {
	if (typeof localStorage === 'undefined') return;

	const keysToRemove: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (!key) continue;

		if (
			APP_STORAGE_KEYS.includes(key) ||
			APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
		) {
			keysToRemove.push(key);
		}
	}

	for (const key of keysToRemove) {
		localStorage.removeItem(key);
	}
}

export async function clearServiceWorkerState(): Promise<void> {
	if (typeof window === 'undefined') return;

	if ('serviceWorker' in navigator) {
		try {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((registration) => registration.unregister()));
		} catch (error) {
			console.warn('Failed to unregister service workers during reset:', error);
		}
	}

	if ('caches' in window) {
		try {
			const cacheNames = await caches.keys();
			await Promise.all(cacheNames.map((name) => caches.delete(name)));
		} catch (error) {
			console.warn('Failed to clear caches during reset:', error);
		}
	}
}

export function markPendingReset(dbName: string): void {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.setItem(RESET_DB_NAME_KEY, dbName);
}

export function getPendingResetDbName(): string | null {
	if (typeof sessionStorage === 'undefined') return null;
	return sessionStorage.getItem(RESET_DB_NAME_KEY);
}

export function clearPendingReset(): void {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.removeItem(RESET_DB_NAME_KEY);
}

export async function deleteIndexedDbDatabase(dbName: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase(dbName);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error(`Deleting IndexedDB "${dbName}" was blocked`));
	});
}
