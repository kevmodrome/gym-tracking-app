import { consumeInviteFromUrl } from '$lib/invite';
import {
	clearPendingReset,
	deleteIndexedDbDatabase,
	getPendingResetDbName,
} from '$lib/reset';

// Parse ?invite= from URL BEFORE any db module import.
// We write directly to localStorage so db.ts picks it up when it initializes.
const url = new URL(window.location.href);
const hasInviteParam = url.searchParams.has('invite');
if (hasInviteParam) {
	try {
		consumeInviteFromUrl(url);
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

	const { db, clearStoredInvite, initializeExercises, deduplicateExercises } = await import('$lib/db');
	const {
		migrateFromDexieIfNeeded,
		migrateInProgressSessions,
		backfillSessionStatus,
		cleanupMalformedSessions,
	} = await import('$lib/migrateDexieToTablinum');
	const { preferencesStore } = await import('$lib/stores/preferences.svelte');

	await db.ready;
	clearStoredInvite();
	await migrateFromDexieIfNeeded(db);
	await migrateInProgressSessions(db);
	await backfillSessionStatus(db);
	await cleanupMalformedSessions(db);
	await initializeExercises();
	await deduplicateExercises();
	await preferencesStore.load();
}
