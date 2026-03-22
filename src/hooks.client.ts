import { decodeInvite } from 'tablinum/svelte';
import {
	clearPendingReset,
	deleteIndexedDbDatabase,
	getPendingResetDbName,
} from '$lib/reset';

// Parse ?invite= from URL BEFORE any db module import.
// We write directly to localStorage so db.ts picks it up when it initializes.
const INVITE_STORAGE_KEY = 'gym-app-invite';
const url = new URL(window.location.href);
const inviteParam = url.searchParams.get('invite');
if (inviteParam) {
	try {
		const invite = decodeInvite(inviteParam);
		localStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify(invite));
		localStorage.setItem('gym-app-joined-via-invite', 'true');
	} catch (e) {
		console.error('Invalid invite in URL:', e);
	}
	url.searchParams.delete('invite');
	window.history.replaceState({}, '', url.toString());
}

export async function init() {
	const pendingResetDbName = getPendingResetDbName();
	if (pendingResetDbName) {
		try {
			await deleteIndexedDbDatabase(pendingResetDbName);
			clearPendingReset();
		} catch (e) {
			console.error('Failed to delete pending reset database:', e);
		}
	}

	const { db, clearStoredInvite, initializeExercises } = await import('$lib/db');
	const { migrateFromDexieIfNeeded } = await import('$lib/migrateDexieToTablinum');
	const { preferencesStore } = await import('$lib/stores/preferences.svelte');

	await db.ready;
	clearStoredInvite();
	await migrateFromDexieIfNeeded(db);
	await initializeExercises();
	await preferencesStore.load();
}
