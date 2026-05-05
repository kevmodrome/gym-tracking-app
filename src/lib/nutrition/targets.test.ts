import { describe, it, expect } from 'vitest';
import { computeBmr, computeTdee, computeTargets } from './targets';
import type { NutritionProfile } from '$lib/types';

const baseProfile: NutritionProfile = {
	id: 'p1',
	heightCm: 180,
	age: 30,
	sex: 'male',
	activityLevel: 'moderate',
	goal: 'maintain',
	proteinPerKg: 2.0,
	manualOverrides: {},
	updatedAt: '',
};

describe('computeBmr (Mifflin-St Jeor)', () => {
	it('male: 10*kg + 6.25*cm - 5*age + 5', () => {
		expect(computeBmr({ kg: 80, cm: 180, age: 30, sex: 'male' })).toBeCloseTo(1780, 0);
	});

	it('female: 10*kg + 6.25*cm - 5*age - 161', () => {
		expect(computeBmr({ kg: 65, cm: 165, age: 28, sex: 'female' })).toBeCloseTo(1380.25, 1);
	});
});

describe('computeTdee', () => {
	it('multiplies BMR by activity multiplier', () => {
		expect(computeTdee(2000, 'moderate')).toBeCloseTo(3100, 0);
		expect(computeTdee(2000, 'sedentary')).toBeCloseTo(2400, 0);
	});
});

describe('computeTargets', () => {
	it('80kg moderate-male maintain ~ 2700kcal, protein 160g', () => {
		const t = computeTargets(baseProfile, 80);
		expect(t.kcal).toBeGreaterThan(2700);
		expect(t.kcal).toBeLessThan(2800);
		expect(t.protein).toBe(160);
	});

	it('cut subtracts 500 kcal', () => {
		const maintain = computeTargets({ ...baseProfile, goal: 'maintain' }, 80);
		const cut = computeTargets({ ...baseProfile, goal: 'cut' }, 80);
		expect(cut.kcal).toBe(maintain.kcal - 500);
	});

	it('bulk adds 300 kcal', () => {
		const maintain = computeTargets({ ...baseProfile, goal: 'maintain' }, 80);
		const bulk = computeTargets({ ...baseProfile, goal: 'bulk' }, 80);
		expect(bulk.kcal).toBe(maintain.kcal + 300);
	});

	it('protein scales with proteinPerKg', () => {
		const t = computeTargets({ ...baseProfile, proteinPerKg: 1.6 }, 80);
		expect(t.protein).toBe(128);
	});

	it('macro split after protein: fat 25% kcal, carbs remainder', () => {
		const t = computeTargets(baseProfile, 80);
		const proteinKcal = t.protein * 4;
		const fatKcal = t.fat * 9;
		const carbsKcal = t.carbs * 4;
		// Allow up to 5 kcal of rounding error from integer-gram macros.
		expect(Math.abs(proteinKcal + fatKcal + carbsKcal - t.kcal)).toBeLessThanOrEqual(5);
		expect(fatKcal / t.kcal).toBeCloseTo(0.25, 1);
	});

	it('manual overrides take precedence', () => {
		const t = computeTargets(
			{ ...baseProfile, manualOverrides: { kcal: 2500, protein: 200 } },
			80,
		);
		expect(t.kcal).toBe(2500);
		expect(t.protein).toBe(200);
	});

	it('returns zeros if weight is zero', () => {
		const t = computeTargets(baseProfile, 0);
		expect(t.kcal).toBe(0);
		expect(t.protein).toBe(0);
	});
});
