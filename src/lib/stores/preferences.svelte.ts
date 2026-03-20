import { db } from '$lib/db';
import type { WeightUnit, DistanceUnit, UserPreferences } from '$lib/types';

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
	private prefsId: string | null = null;

	get weightLabel(): string {
		return this.weightUnit === 'kg' ? 'kg' : 'lbs';
	}

	get distanceLabel(): string {
		return this.distanceUnit === 'km' ? 'km' : 'mi';
	}

	async load(): Promise<void> {
		if (this.loaded) return;
		try {
			const saved = await db.collection('preferences').first() as (UserPreferences | null);
			if (saved) {
				this.prefsId = saved.id;
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
						// Save to Tablinum
						await this.persist();
					} catch {
						// ignore parse errors
					}
				}
			}
		} catch {
			// DB not available (SSR), use defaults
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
			const data = {
				weightUnit: this.weightUnit,
				distanceUnit: this.distanceUnit,
				decimalPlaces: this.decimalPlaces,
				updatedAt: new Date().toISOString()
			};
			if (this.prefsId) {
				await db.collection('preferences').update(this.prefsId, data);
			} else {
				this.prefsId = await db.collection('preferences').add(data);
			}
		} catch {
			// DB not available
		}
	}

	/** Called after sync replaces data to refresh store state */
	async refresh(): Promise<void> {
		try {
			const saved = await db.collection('preferences').first() as (UserPreferences | null);
			if (saved) {
				this.prefsId = saved.id;
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
