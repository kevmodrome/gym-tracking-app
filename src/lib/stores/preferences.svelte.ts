import type { AppPreferences, WeightUnit } from '$lib/types';
import { db, type DbPreferences } from '$lib/db';
import { browser } from '$app/environment';

const LEGACY_STORAGE_KEY = 'gym-app-preferences';
const DEFAULT_ID = 'default';

const defaultPreferences: AppPreferences = {
	theme: 'system',
	weightUnit: 'lb',
	distanceUnit: 'km',
	decimalPlaces: 1
};

// Check for legacy localStorage data and migrate it
async function migrateFromLocalStorage(): Promise<AppPreferences | null> {
	if (!browser) return null;

	try {
		const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			// Clear legacy storage after reading
			localStorage.removeItem(LEGACY_STORAGE_KEY);
			return { ...defaultPreferences, ...parsed };
		}
	} catch (e) {
		console.error('Failed to migrate preferences from localStorage:', e);
	}
	return null;
}

async function loadFromDb(): Promise<AppPreferences> {
	if (!browser) return defaultPreferences;

	try {
		const saved = await db.preferences.get(DEFAULT_ID);
		if (saved) {
			return {
				theme: saved.theme,
				weightUnit: saved.weightUnit,
				distanceUnit: saved.distanceUnit,
				decimalPlaces: saved.decimalPlaces
			};
		}

		// Check for legacy localStorage data
		const migrated = await migrateFromLocalStorage();
		if (migrated) {
			// Save migrated data to db
			await saveToDb(migrated);
			return migrated;
		}
	} catch (e) {
		console.error('Failed to load preferences from db:', e);
	}
	return defaultPreferences;
}

async function saveToDb(preferences: AppPreferences): Promise<void> {
	if (!browser) return;

	try {
		const dbRecord: DbPreferences = {
			id: DEFAULT_ID,
			...preferences,
			updatedAt: Date.now()
		};
		await db.preferences.put(dbRecord);
	} catch (e) {
		console.error('Failed to save preferences to db:', e);
	}
}

class PreferencesStore {
	#preferences = $state<AppPreferences>(defaultPreferences);
	#initialized = false;

	constructor() {
		// Initialize from db on client side
		if (browser) {
			this.#init();
		}
	}

	async #init() {
		if (this.#initialized) return;
		this.#initialized = true;

		const loaded = await loadFromDb();
		this.#preferences = loaded;
	}

	get weightUnit(): WeightUnit {
		return this.#preferences.weightUnit;
	}

	set weightUnit(value: WeightUnit) {
		this.#preferences.weightUnit = value;
		saveToDb(this.#preferences);
	}

	get theme() {
		return this.#preferences.theme;
	}

	set theme(value: AppPreferences['theme']) {
		this.#preferences.theme = value;
		saveToDb(this.#preferences);
	}

	get distanceUnit() {
		return this.#preferences.distanceUnit;
	}

	set distanceUnit(value: AppPreferences['distanceUnit']) {
		this.#preferences.distanceUnit = value;
		saveToDb(this.#preferences);
	}

	get decimalPlaces() {
		return this.#preferences.decimalPlaces;
	}

	set decimalPlaces(value: number) {
		this.#preferences.decimalPlaces = value;
		saveToDb(this.#preferences);
	}

	get all(): AppPreferences {
		return this.#preferences;
	}

	set all(value: AppPreferences) {
		this.#preferences = value;
		saveToDb(this.#preferences);
	}

	// Method to reload preferences from db (called after sync)
	async reload() {
		const loaded = await loadFromDb();
		this.#preferences = loaded;
	}
}

export const preferencesStore = new PreferencesStore();
