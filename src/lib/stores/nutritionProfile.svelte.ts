import {
	getNutritionProfile,
	upsertNutritionProfile,
} from '$lib/nutrition/db';
import type {
	ActivityLevel,
	NutritionGoal,
	NutritionProfile,
	Sex,
	FoodMacros,
} from '$lib/types';

const DEFAULTS: Omit<NutritionProfile, 'id' | 'updatedAt'> = {
	heightCm: 180,
	age: 30,
	sex: 'male',
	activityLevel: 'moderate',
	goal: 'maintain',
	proteinPerKg: 2.0,
	manualOverrides: {},
};

class NutritionProfileStore {
	heightCm = $state<number>(DEFAULTS.heightCm);
	age = $state<number>(DEFAULTS.age);
	sex = $state<Sex>(DEFAULTS.sex);
	activityLevel = $state<ActivityLevel>(DEFAULTS.activityLevel);
	goal = $state<NutritionGoal>(DEFAULTS.goal);
	proteinPerKg = $state<number>(DEFAULTS.proteinPerKg);
	manualOverrides = $state<Partial<FoodMacros>>({ ...DEFAULTS.manualOverrides });
	private loaded = false;

	async load(): Promise<void> {
		if (this.loaded) return;
		try {
			const saved = await getNutritionProfile();
			if (saved) {
				this.heightCm = saved.heightCm;
				this.age = saved.age;
				this.sex = saved.sex;
				this.activityLevel = saved.activityLevel;
				this.goal = saved.goal;
				this.proteinPerKg = saved.proteinPerKg;
				this.manualOverrides = { ...saved.manualOverrides };
			}
		} catch {
			// SSR / db not ready
		}
		this.loaded = true;
	}

	async save(): Promise<void> {
		await upsertNutritionProfile({
			heightCm: this.heightCm,
			age: this.age,
			sex: this.sex,
			activityLevel: this.activityLevel,
			goal: this.goal,
			proteinPerKg: this.proteinPerKg,
			manualOverrides: $state.snapshot(this.manualOverrides),
		});
	}

	async refresh(): Promise<void> {
		this.loaded = false;
		await this.load();
	}

	snapshot(): NutritionProfile {
		return {
			id: 'snapshot',
			heightCm: this.heightCm,
			age: this.age,
			sex: this.sex,
			activityLevel: this.activityLevel,
			goal: this.goal,
			proteinPerKg: this.proteinPerKg,
			manualOverrides: { ...this.manualOverrides },
			updatedAt: '',
		};
	}
}

export const nutritionProfileStore = new NutritionProfileStore();
