import type {
	ActivityLevel,
	FoodMacros,
	NutritionProfile,
	Sex,
} from '$lib/types';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
	sedentary: 1.2,
	light: 1.375,
	moderate: 1.55,
	active: 1.725,
	very_active: 1.9,
};

const GOAL_DELTAS = {
	cut: -500,
	maintain: 0,
	bulk: 300,
} as const;

const FAT_KCAL_RATIO = 0.25;

export function computeBmr(args: {
	kg: number;
	cm: number;
	age: number;
	sex: Sex;
}): number {
	const base = 10 * args.kg + 6.25 * args.cm - 5 * args.age;
	return args.sex === 'male' ? base + 5 : base - 161;
}

export function computeTdee(bmr: number, activity: ActivityLevel): number {
	return bmr * ACTIVITY_MULTIPLIERS[activity];
}

export function computeTargets(profile: NutritionProfile, kg: number): FoodMacros {
	if (kg <= 0) {
		return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
	}
	const bmr = computeBmr({ kg, cm: profile.heightCm, age: profile.age, sex: profile.sex });
	const tdee = computeTdee(bmr, profile.activityLevel);
	const computedKcal = Math.round(tdee + GOAL_DELTAS[profile.goal]);
	const computedProtein = Math.round(kg * profile.proteinPerKg);

	const kcal = profile.manualOverrides.kcal ?? computedKcal;
	const protein = profile.manualOverrides.protein ?? computedProtein;

	const proteinKcal = protein * 4;
	const fatKcal = profile.manualOverrides.fat !== undefined
		? profile.manualOverrides.fat * 9
		: Math.round(kcal * FAT_KCAL_RATIO);
	const remainingKcal = Math.max(0, kcal - proteinKcal - fatKcal);
	const fat = profile.manualOverrides.fat ?? Math.round(fatKcal / 9);
	const carbs = profile.manualOverrides.carbs ?? Math.round(remainingKcal / 4);

	return { kcal, protein, carbs, fat };
}

export function macrosFromGrams(per100g: FoodMacros, grams: number): FoodMacros {
	const factor = grams / 100;
	return {
		kcal: Math.round(per100g.kcal * factor),
		protein: Math.round(per100g.protein * factor * 10) / 10,
		carbs: Math.round(per100g.carbs * factor * 10) / 10,
		fat: Math.round(per100g.fat * factor * 10) / 10,
	};
}
