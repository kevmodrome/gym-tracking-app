import { db } from '$lib/db';
import type {
	WeightUnit,
	DistanceUnit,
	UserPreferences,
	OnboardingGoal,
	TrackingDepth
} from '$lib/types';

const DEFAULTS: Omit<UserPreferences, 'id' | 'updatedAt'> = {
	weightUnit: 'kg',
	distanceUnit: 'km',
	decimalPlaces: 1,
	goal: undefined,
	trackingDepth: undefined,
	onboardingComplete: false
};

class PreferencesStore {
	weightUnit = $state<WeightUnit>(DEFAULTS.weightUnit);
	distanceUnit = $state<DistanceUnit>(DEFAULTS.distanceUnit);
	decimalPlaces = $state<number>(DEFAULTS.decimalPlaces);
	goal = $state<OnboardingGoal | undefined>(undefined);
	trackingDepth = $state<TrackingDepth | undefined>(undefined);
	onboardingComplete = $state<boolean>(false);
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
			const saved = (await db.collection('preferences').first()) as UserPreferences | null;
			if (saved) {
				this.prefsId = saved.id;
				this.weightUnit = saved.weightUnit;
				this.distanceUnit = saved.distanceUnit;
				this.decimalPlaces = saved.decimalPlaces;
				this.goal = saved.goal;
				this.trackingDepth = saved.trackingDepth;
				this.onboardingComplete = saved.onboardingComplete ?? false;
			} else {
				// Migrate from localStorage if available
				const legacy = localStorage.getItem('gym-app-preferences');
				if (legacy) {
					try {
						const parsed = JSON.parse(legacy);
						if (parsed.weightUnit) this.weightUnit = parsed.weightUnit;
						if (parsed.distanceUnit) this.distanceUnit = parsed.distanceUnit;
						if (parsed.decimalPlaces !== undefined) this.decimalPlaces = parsed.decimalPlaces;
						if (parsed.goal) this.goal = parsed.goal;
						if (parsed.trackingDepth) this.trackingDepth = parsed.trackingDepth;
						if (parsed.onboardingComplete !== undefined)
							this.onboardingComplete = parsed.onboardingComplete;
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

	async update(
		partial: Partial<
			Pick<
				UserPreferences,
				| 'weightUnit'
				| 'distanceUnit'
				| 'decimalPlaces'
				| 'goal'
				| 'trackingDepth'
				| 'onboardingComplete'
			>
		>
	): Promise<void> {
		if (partial.weightUnit !== undefined) this.weightUnit = partial.weightUnit;
		if (partial.distanceUnit !== undefined) this.distanceUnit = partial.distanceUnit;
		if (partial.decimalPlaces !== undefined) this.decimalPlaces = partial.decimalPlaces;
		if (partial.goal !== undefined) this.goal = partial.goal;
		if (partial.trackingDepth !== undefined) this.trackingDepth = partial.trackingDepth;
		if (partial.onboardingComplete !== undefined)
			this.onboardingComplete = partial.onboardingComplete;
		await this.persist();
	}

	private async persist(): Promise<void> {
		try {
			const data = {
				weightUnit: this.weightUnit,
				distanceUnit: this.distanceUnit,
				decimalPlaces: this.decimalPlaces,
				goal: this.goal,
				trackingDepth: this.trackingDepth,
				onboardingComplete: this.onboardingComplete,
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
			const saved = (await db.collection('preferences').first()) as UserPreferences | null;
			if (saved) {
				this.prefsId = saved.id;
				this.weightUnit = saved.weightUnit;
				this.distanceUnit = saved.distanceUnit;
				this.decimalPlaces = saved.decimalPlaces;
				this.goal = saved.goal;
				this.trackingDepth = saved.trackingDepth;
				this.onboardingComplete = saved.onboardingComplete ?? false;
			}
		} catch {
			// ignore
		}
	}
}

export const preferencesStore = new PreferencesStore();
