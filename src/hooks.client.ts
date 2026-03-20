import { db } from '$lib/db';
import { migrateFromDexieIfNeeded } from '$lib/migrateDexieToTablinum';
import { preferencesStore } from '$lib/stores/preferences.svelte';

export async function init() {
	await db.ready;
	await migrateFromDexieIfNeeded(db);
	await preferencesStore.load();
}
