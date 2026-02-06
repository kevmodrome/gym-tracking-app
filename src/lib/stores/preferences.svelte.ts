import { db } from '$lib/db';
import type { WeightUnit, DistanceUnit, UserPreferences } from '$lib/types';

const PREFERENCES_ID = 'default';

const DEFAULTS: Omit<UserPreferences, 'id' | 'updatedAt'> = {
	weightUnit: 'kg',
	distanceUnit: 'km',
	decimalPlaces: 1
};

class PreferencesStore {
	weightUnit = $state<WeightUnit>(DEFAULTS.weightUnit);
	distanceUnit = $state<DistanceUnit>(DEFAULTS.distanceUnit);
	decimalPlaces = $state<number>(DEFAULTS.decimalPlaces);
	private loaded = false;

	get weightLabel(): string {
		return this.weightUnit === 'kg' ? 'kg' : 'lbs';
	}

	get distanceLabel(): string {
		return this.distanceUnit === 'km' ? 'km' : 'mi';
	}

	async load(): Promise<void> {
		if (this.loaded) return;
		try {
			const saved = await db.preferences.get(PREFERENCES_ID);
			if (saved) {
				this.weightUnit = saved.weightUnit;
				this.distanceUnit = saved.distanceUnit;
				this.decimalPlaces = saved.decimalPlaces;
			} else {
				// Migrate from localStorage if available
				const legacy = localStorage.getItem('gym-app-preferences');
				if (legacy) {
					try {
						const parsed = JSON.parse(legacy);
						if (parsed.weightUnit) this.weightUnit = parsed.weightUnit;
						if (parsed.distanceUnit) this.distanceUnit = parsed.distanceUnit;
						if (parsed.decimalPlaces !== undefined) this.decimalPlaces = parsed.decimalPlaces;
						// Save to IDB
						await this.persist();
					} catch {
						// ignore parse errors
					}
				}
			}
		} catch {
			// IDB not available (SSR), use defaults
		}
		this.loaded = true;
	}

	async update(partial: Partial<Pick<UserPreferences, 'weightUnit' | 'distanceUnit' | 'decimalPlaces'>>): Promise<void> {
		if (partial.weightUnit !== undefined) this.weightUnit = partial.weightUnit;
		if (partial.distanceUnit !== undefined) this.distanceUnit = partial.distanceUnit;
		if (partial.decimalPlaces !== undefined) this.decimalPlaces = partial.decimalPlaces;
		await this.persist();
	}

	private async persist(): Promise<void> {
		try {
			await db.preferences.put({
				id: PREFERENCES_ID,
				weightUnit: this.weightUnit,
				distanceUnit: this.distanceUnit,
				decimalPlaces: this.decimalPlaces,
				updatedAt: new Date().toISOString()
			});
		} catch {
			// IDB not available
		}
	}

	/** Called after sync replaces IDB data to refresh store state */
	async refresh(): Promise<void> {
		try {
			const saved = await db.preferences.get(PREFERENCES_ID);
			if (saved) {
				this.weightUnit = saved.weightUnit;
				this.distanceUnit = saved.distanceUnit;
				this.decimalPlaces = saved.decimalPlaces;
			}
		} catch {
			// ignore
		}
	}
}

export const preferencesStore = new PreferencesStore();
