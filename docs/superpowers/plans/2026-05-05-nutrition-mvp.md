# Nutrition Tracking MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protein-focused nutrition tracker (with Swedish food DB + barcode scanning + weight history) to GymTrack, syncing via the existing Tablinum P2P/CRDT layer; introduce a new "Log" tab that paves the way for a future Health-App rebrand.

**Architecture:** Mirrors existing patterns — Tablinum collections for synced data, Svelte 5 runes for stores, Tailwind v4 dark-mode UI reusing existing primitives. Static Livsmedelsverket bundle (built at prepare-time into `/static/livs-foods.json`) for offline food search; Open Food Facts for barcoded products with cache-on-success into the synced `foods` collection. Macros snapshot on each entry so historical totals are stable.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Tailwind v4, Tablinum, svelteplot (charts), `@zxing/browser` (barcode fallback), Vitest + Testing Library.

**Reference spec:** `/Users/kevin/.claude/plans/system-instruction-you-are-working-imperative-kite.md` (approved 2026-05-05).

---

## File Structure

### New files (all paths from repo root)

```
src/lib/types.ts                                    # extend with new interfaces
src/lib/db.ts                                       # extend schema with new collections
src/lib/nutrition/targets.ts                        # BMR, TDEE, macro split (pure)
src/lib/nutrition/livs.ts                           # bundled DB loader + search
src/lib/nutrition/off.ts                            # Open Food Facts client + cache
src/lib/nutrition/scanner.ts                        # BarcodeDetector + zxing fallback
src/lib/nutrition/db.ts                             # Tablinum CRUD helpers (foods/foodEntries/weights)
src/lib/nutrition/dates.ts                          # date helpers (toDateString, etc.)
src/lib/stores/nutritionProfile.svelte.ts           # runes store mirroring preferences pattern

src/lib/components/MacroRings.svelte                # daily progress display
src/lib/components/FoodSearch.svelte                # saved + Livs search dropdown
src/lib/components/FoodEntryForm.svelte             # grams + recompute macros
src/lib/components/BarcodeScanner.svelte            # camera UI + scan callback
src/lib/components/WeightChart.svelte               # svelteplot weight history
src/lib/components/DateNavigator.svelte             # prev/next/today date picker

src/routes/(public)/log/+page.svelte                # new Log tab
src/routes/(public)/log/scan/+page.svelte           # full-screen scanner
src/routes/(public)/progress/nutrition/+page.svelte # nutrition history
src/routes/(public)/progress/weight/+page.svelte    # weight chart + entry
src/routes/(public)/settings/profile/+page.svelte   # profile + targets editor

scripts/build-livs.ts                               # build-time normalization
static/livs-foods.json                              # generated artifact (committed)
data/livs-source/                                   # raw upstream files (committed once verified)

src/lib/nutrition/targets.test.ts                   # vitest
src/lib/nutrition/livs.test.ts                      # vitest
src/lib/nutrition/off.test.ts                       # vitest
src/lib/nutrition/dates.test.ts                     # vitest
```

### Modified files

```
src/lib/components/Navigation.svelte    # add "Log" tab between Exercises and Progress
src/routes/(public)/progress/+layout.svelte  # add Nutrition + Weight tabs
src/routes/(public)/settings/+page.svelte    # link to /settings/profile
package.json                                  # add @zxing/browser; add build-livs script
```

### Reused (no changes)

`Card`, `MetricCard`, `PageHeader`, `Modal`, `NumberSpinner`, `SearchInput`, `TextInput`, `Toggle`, `Button`, `Toast`, `toastStore`, `preferencesStore` (pattern), `svelteplot`, Tablinum sync infra.

---

## Task 1: Define types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add nutrition interfaces to `src/lib/types.ts`**

Append at end of file:

```typescript
export type FoodSource = 'livs' | 'off' | 'custom';

export interface FoodMacros {
	kcal: number;
	protein: number;
	carbs: number;
	fat: number;
}

export interface FoodServingSize {
	grams: number;
	label: string;
}

export interface Food {
	id: string;
	source: FoodSource;
	externalId?: string;
	barcode?: string;
	name: string;
	brand?: string;
	per100g: FoodMacros;
	servingSize?: FoodServingSize;
	lastUsedAt: string;
	createdAt: string;
}

export interface FoodEntry {
	id: string;
	date: string;          // YYYY-MM-DD, device-local
	loggedAt: string;      // ISO timestamp
	foodId?: string;
	inlineFood?: { name: string; per100g: FoodMacros };
	grams: number;
	macros: FoodMacros;    // snapshot
	note?: string;
}

export interface Weight {
	id: string;
	date: string;          // YYYY-MM-DD, unique
	kg: number;
	loggedAt: string;
}

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type NutritionGoal = 'cut' | 'maintain' | 'bulk';

export interface NutritionProfile {
	id: string;
	heightCm: number;
	age: number;
	sex: Sex;
	activityLevel: ActivityLevel;
	goal: NutritionGoal;
	proteinPerKg: number;          // default 2.0
	manualOverrides: Partial<FoodMacros>;
	updatedAt: string;
}
```

- [ ] **Step 2: Verify type-check**

Run: `npm run check`
Expected: PASS (no svelte-check errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(nutrition): add type definitions"
```

---

## Task 2: Register Tablinum collections

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add field schemas above the existing `schema` const in `src/lib/db.ts`**

Insert after the existing `preferencesDef` (before the `schema` object):

```typescript
const foodMacrosDef = field.object({
	kcal: field.number(),
	protein: field.number(),
	carbs: field.number(),
	fat: field.number(),
});

const foodServingDef = field.object({
	grams: field.number(),
	label: field.string(),
});

const foodsDef = collection('foods', {
	source: field.string(),
	externalId: field.optional(field.string()),
	barcode: field.optional(field.string()),
	name: field.string(),
	brand: field.optional(field.string()),
	per100g: foodMacrosDef,
	servingSize: field.optional(foodServingDef),
	lastUsedAt: field.string(),
	createdAt: field.string(),
}, { indices: ['barcode', 'name', 'lastUsedAt'] });

const foodEntriesDef = collection('foodEntries', {
	date: field.string(),
	loggedAt: field.string(),
	foodId: field.optional(field.string()),
	inlineFood: field.optional(field.object({
		name: field.string(),
		per100g: foodMacrosDef,
	})),
	grams: field.number(),
	macros: foodMacrosDef,
	note: field.optional(field.string()),
}, { indices: ['date', 'loggedAt'] });

const weightsDef = collection('weights', {
	date: field.string(),
	kg: field.number(),
	loggedAt: field.string(),
}, { indices: ['date'] });

const nutritionProfileDef = collection('nutritionProfile', {
	heightCm: field.number(),
	age: field.number(),
	sex: field.string(),
	activityLevel: field.string(),
	goal: field.string(),
	proteinPerKg: field.number(),
	manualOverrides: field.object({
		kcal: field.optional(field.number()),
		protein: field.optional(field.number()),
		carbs: field.optional(field.number()),
		fat: field.optional(field.number()),
	}),
	updatedAt: field.string(),
});
```

- [ ] **Step 2: Add the new collections to the `schema` object**

Replace:

```typescript
const schema = {
	exercises: exercisesDef,
	workouts: workoutsDef,
	sessions: sessionsDef,
	personalRecords: personalRecordsDef,
	preferences: preferencesDef,
};
```

with:

```typescript
const schema = {
	exercises: exercisesDef,
	workouts: workoutsDef,
	sessions: sessionsDef,
	personalRecords: personalRecordsDef,
	preferences: preferencesDef,
	foods: foodsDef,
	foodEntries: foodEntriesDef,
	weights: weightsDef,
	nutritionProfile: nutritionProfileDef,
};
```

- [ ] **Step 3: Verify type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(nutrition): register Tablinum collections"
```

---

## Task 3: Date helpers (TDD)

**Files:**
- Create: `src/lib/nutrition/dates.ts`
- Test:   `src/lib/nutrition/dates.test.ts`

- [ ] **Step 1: Write failing tests in `src/lib/nutrition/dates.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { toDateString, todayString, addDays, formatDateLabel } from './dates';

describe('toDateString', () => {
	it('formats local date as YYYY-MM-DD', () => {
		const d = new Date(2026, 4, 5, 14, 30); // May 5, 2026 local
		expect(toDateString(d)).toBe('2026-05-05');
	});

	it('handles single-digit months and days with zero-padding', () => {
		expect(toDateString(new Date(2026, 0, 9))).toBe('2026-01-09');
	});
});

describe('todayString', () => {
	it('returns a YYYY-MM-DD string', () => {
		expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('addDays', () => {
	it('adds positive days', () => {
		expect(addDays('2026-05-05', 3)).toBe('2026-05-08');
	});
	it('subtracts with negative delta', () => {
		expect(addDays('2026-05-05', -1)).toBe('2026-05-04');
	});
	it('crosses month boundaries', () => {
		expect(addDays('2026-05-31', 1)).toBe('2026-06-01');
	});
});

describe('formatDateLabel', () => {
	it('renders "Today" for today', () => {
		expect(formatDateLabel(todayString())).toBe('Today');
	});
	it('renders "Yesterday" for one day before', () => {
		expect(formatDateLabel(addDays(todayString(), -1))).toBe('Yesterday');
	});
	it('renders longer dates as locale-formatted', () => {
		const label = formatDateLabel('2024-01-15');
		expect(label).toMatch(/Jan/);
	});
});
```

- [ ] **Step 2: Run tests, confirm fail**

Run: `npm run test:run -- src/lib/nutrition/dates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/nutrition/dates.ts`**

```typescript
export function toDateString(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function todayString(): string {
	return toDateString(new Date());
}

export function addDays(dateStr: string, delta: number): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	const dt = new Date(y, m - 1, d);
	dt.setDate(dt.getDate() + delta);
	return toDateString(dt);
}

export function formatDateLabel(dateStr: string): string {
	const today = todayString();
	if (dateStr === today) return 'Today';
	if (dateStr === addDays(today, -1)) return 'Yesterday';
	const [y, m, d] = dateStr.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	});
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npm run test:run -- src/lib/nutrition/dates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nutrition/dates.ts src/lib/nutrition/dates.test.ts
git commit -m "feat(nutrition): add date helpers"
```

---

## Task 4: Targets calculation (TDD)

**Files:**
- Create: `src/lib/nutrition/targets.ts`
- Test:   `src/lib/nutrition/targets.test.ts`

Reference values:
- BMR (Mifflin–St Jeor): male = 10·kg + 6.25·cm − 5·age + 5; female = 10·kg + 6.25·cm − 5·age − 161
- Activity multipliers: sedentary 1.2, light 1.375, moderate 1.55, active 1.725, very_active 1.9
- Goal kcal delta: cut −500, maintain 0, bulk +300

- [ ] **Step 1: Write failing tests in `src/lib/nutrition/targets.test.ts`**

```typescript
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
		// 80kg, 180cm, 30y, male = 800 + 1125 - 150 + 5 = 1780
		expect(computeBmr({ kg: 80, cm: 180, age: 30, sex: 'male' })).toBeCloseTo(1780, 0);
	});

	it('female: 10*kg + 6.25*cm - 5*age - 161', () => {
		// 65kg, 165cm, 28y, female = 650 + 1031.25 - 140 - 161 = 1380.25
		expect(computeBmr({ kg: 65, cm: 165, age: 28, sex: 'female' })).toBeCloseTo(1380.25, 1);
	});
});

describe('computeTdee', () => {
	it('multiplies BMR by activity multiplier', () => {
		expect(computeTdee(2000, 'moderate')).toBeCloseTo(3100, 0); // 2000*1.55
		expect(computeTdee(2000, 'sedentary')).toBeCloseTo(2400, 0); // 2000*1.2
	});
});

describe('computeTargets', () => {
	it('80kg moderate-male maintain ~ 2700kcal, protein 160g', () => {
		const t = computeTargets(baseProfile, 80);
		expect(t.kcal).toBeGreaterThan(2700);
		expect(t.kcal).toBeLessThan(2800);
		expect(t.protein).toBe(160); // 80 * 2.0
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
		expect(proteinKcal + fatKcal + carbsKcal).toBeCloseTo(t.kcal, 0);
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
```

- [ ] **Step 2: Run tests, confirm fail**

Run: `npm run test:run -- src/lib/nutrition/targets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/nutrition/targets.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npm run test:run -- src/lib/nutrition/targets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nutrition/targets.ts src/lib/nutrition/targets.test.ts
git commit -m "feat(nutrition): add BMR/TDEE/macro target math"
```

---

## Task 5: Tablinum CRUD helpers

**Files:**
- Create: `src/lib/nutrition/db.ts`

This module wraps `db.collection(...)` calls so route code does not duplicate query patterns. Mirrors how `db.ts` exposes `seedDefaultExercises` etc.

- [ ] **Step 1: Implement `src/lib/nutrition/db.ts`**

```typescript
import { db } from '$lib/db';
import type {
	Food,
	FoodEntry,
	FoodMacros,
	NutritionProfile,
	Weight,
} from '$lib/types';

// ---------- foods ----------
export async function listSavedFoods(limit = 50): Promise<Food[]> {
	const all = await db.collection('foods').get() as Food[];
	return all
		.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
		.slice(0, limit);
}

export async function searchSavedFoods(query: string, limit = 20): Promise<Food[]> {
	const q = query.trim().toLowerCase();
	if (!q) return listSavedFoods(limit);
	const all = await db.collection('foods').get() as Food[];
	return all
		.filter((f) => f.name.toLowerCase().includes(q) || (f.brand?.toLowerCase().includes(q) ?? false))
		.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
		.slice(0, limit);
}

export async function findFoodByBarcode(barcode: string): Promise<Food | null> {
	const results = await db.collection('foods').where('barcode').equals(barcode).get() as Food[];
	return results[0] ?? null;
}

export async function getFoodById(id: string): Promise<Food | null> {
	const f = await db.collection('foods').get(id) as Food | null;
	return f ?? null;
}

export async function addFood(food: Omit<Food, 'id'>): Promise<string> {
	return await db.collection('foods').add(food);
}

export async function touchFood(id: string): Promise<void> {
	await db.collection('foods').update(id, { lastUsedAt: new Date().toISOString() });
}

export async function deleteFood(id: string): Promise<void> {
	await db.collection('foods').delete(id);
}

// ---------- foodEntries ----------
export async function listEntriesForDate(date: string): Promise<FoodEntry[]> {
	const all = await db.collection('foodEntries').where('date').equals(date).get() as FoodEntry[];
	return all.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
}

export async function dailyTotals(date: string): Promise<FoodMacros> {
	const entries = await listEntriesForDate(date);
	return entries.reduce<FoodMacros>(
		(acc, e) => ({
			kcal: acc.kcal + e.macros.kcal,
			protein: acc.protein + e.macros.protein,
			carbs: acc.carbs + e.macros.carbs,
			fat: acc.fat + e.macros.fat,
		}),
		{ kcal: 0, protein: 0, carbs: 0, fat: 0 },
	);
}

export async function addEntry(entry: Omit<FoodEntry, 'id'>): Promise<string> {
	const id = await db.collection('foodEntries').add(entry);
	if (entry.foodId) {
		await touchFood(entry.foodId);
	}
	return id;
}

export async function updateEntry(id: string, partial: Partial<FoodEntry>): Promise<void> {
	await db.collection('foodEntries').update(id, partial);
}

export async function deleteEntry(id: string): Promise<void> {
	await db.collection('foodEntries').delete(id);
}

// ---------- weights ----------
export async function listWeights(): Promise<Weight[]> {
	const all = await db.collection('weights').get() as Weight[];
	return all.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getWeightForDate(date: string): Promise<Weight | null> {
	const all = await db.collection('weights').where('date').equals(date).get() as Weight[];
	return all[0] ?? null;
}

export async function upsertWeightForDate(date: string, kg: number): Promise<void> {
	const existing = await getWeightForDate(date);
	const loggedAt = new Date().toISOString();
	if (existing) {
		await db.collection('weights').update(existing.id, { kg, loggedAt });
	} else {
		await db.collection('weights').add({ date, kg, loggedAt });
	}
}

export async function latestWeightKg(): Promise<number | null> {
	const all = await listWeights();
	return all.length > 0 ? all[all.length - 1].kg : null;
}

// ---------- nutritionProfile (singleton) ----------
export async function getNutritionProfile(): Promise<NutritionProfile | null> {
	const f = await db.collection('nutritionProfile').first() as NutritionProfile | null;
	return f ?? null;
}

export async function upsertNutritionProfile(
	partial: Omit<NutritionProfile, 'id' | 'updatedAt'>,
): Promise<void> {
	const existing = await getNutritionProfile();
	const updatedAt = new Date().toISOString();
	if (existing) {
		await db.collection('nutritionProfile').update(existing.id, { ...partial, updatedAt });
	} else {
		await db.collection('nutritionProfile').add({ ...partial, updatedAt });
	}
}
```

- [ ] **Step 2: Verify type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/nutrition/db.ts
git commit -m "feat(nutrition): add Tablinum CRUD helpers"
```

---

## Task 6: Nutrition profile store

**Files:**
- Create: `src/lib/stores/nutritionProfile.svelte.ts`

Mirrors `preferencesStore` shape (load / update / refresh) but holds the nutrition profile. The route components are responsible for displaying computed targets via `computeTargets` from `targets.ts`.

- [ ] **Step 1: Implement `src/lib/stores/nutritionProfile.svelte.ts`**

```typescript
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
			manualOverrides: { ...this.manualOverrides },
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
```

- [ ] **Step 2: Verify type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/nutritionProfile.svelte.ts
git commit -m "feat(nutrition): add profile store"
```

---

## Task 7: MacroRings component

**Files:**
- Create: `src/lib/components/MacroRings.svelte`

Simple progress bars (not literal rings — using bars keeps it lightweight and matches existing UI grain). Reuses `Card` styling tokens from `app.css` (`--color-accent`, `--color-surface`).

- [ ] **Step 1: Implement `src/lib/components/MacroRings.svelte`**

```svelte
<script lang="ts">
	import type { FoodMacros } from '$lib/types';

	interface Props {
		current: FoodMacros;
		target: FoodMacros;
	}

	const { current, target }: Props = $props();

	function pct(c: number, t: number): number {
		if (t <= 0) return 0;
		return Math.min(100, Math.round((c / t) * 100));
	}

	const rows = $derived([
		{ label: 'Protein', unit: 'g', current: current.protein, target: target.protein, accent: 'bg-accent' },
		{ label: 'Calories', unit: 'kcal', current: current.kcal, target: target.kcal, accent: 'bg-accent/70' },
		{ label: 'Carbs', unit: 'g', current: current.carbs, target: target.carbs, accent: 'bg-accent/50' },
		{ label: 'Fat', unit: 'g', current: current.fat, target: target.fat, accent: 'bg-accent/40' },
	]);
</script>

<div class="space-y-3">
	{#each rows as r}
		<div>
			<div class="flex justify-between text-sm mb-1">
				<span class="text-text-secondary">{r.label}</span>
				<span class="text-text-primary font-medium">
					{r.current} / {r.target} {r.unit}
				</span>
			</div>
			<div class="h-2 rounded-full bg-surface-hover overflow-hidden">
				<div
					class="h-full {r.accent} transition-all duration-300"
					style="width: {pct(r.current, r.target)}%"
				></div>
			</div>
		</div>
	{/each}
</div>
```

- [ ] **Step 2: Verify type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/MacroRings.svelte
git commit -m "feat(nutrition): add MacroRings progress component"
```

---

## Task 8: DateNavigator component

**Files:**
- Create: `src/lib/components/DateNavigator.svelte`

- [ ] **Step 1: Implement `src/lib/components/DateNavigator.svelte`**

```svelte
<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { addDays, formatDateLabel, todayString } from '$lib/nutrition/dates';

	interface Props {
		date: string;
		onChange: (date: string) => void;
	}

	const { date, onChange }: Props = $props();

	function prev() { onChange(addDays(date, -1)); }
	function next() { onChange(addDays(date, 1)); }
	function today() { onChange(todayString()); }
</script>

<div class="flex items-center justify-between gap-2">
	<button
		type="button"
		onclick={prev}
		class="p-2 rounded-lg hover:bg-surface-hover transition"
		aria-label="Previous day"
	>
		<ChevronLeft class="w-5 h-5" />
	</button>
	<button
		type="button"
		onclick={today}
		class="text-sm font-medium text-text-primary px-3 py-1 rounded-lg hover:bg-surface-hover transition"
	>
		{formatDateLabel(date)}
	</button>
	<button
		type="button"
		onclick={next}
		class="p-2 rounded-lg hover:bg-surface-hover transition"
		aria-label="Next day"
		disabled={date >= todayString()}
	>
		<ChevronRight class="w-5 h-5" />
	</button>
</div>
```

- [ ] **Step 2: Verify type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/DateNavigator.svelte
git commit -m "feat(nutrition): add DateNavigator component"
```

---

## Task 9: FoodEntryForm component

**Files:**
- Create: `src/lib/components/FoodEntryForm.svelte`

Used for both the saved-food path and the manual one-off path. Renders grams input + recomputed macros preview + save button.

- [ ] **Step 1: Implement `src/lib/components/FoodEntryForm.svelte`**

```svelte
<script lang="ts">
	import NumberSpinner from '$lib/ui/NumberSpinner.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { macrosFromGrams } from '$lib/nutrition/targets';
	import type { FoodMacros } from '$lib/types';

	interface Props {
		name: string;                    // food display name (read-only here)
		per100g: FoodMacros;
		initialGrams?: number;
		initialNote?: string;
		submitLabel?: string;
		onSubmit: (args: { grams: number; note?: string; macros: FoodMacros }) => void;
		onCancel?: () => void;
	}

	let {
		name,
		per100g,
		initialGrams = 100,
		initialNote = '',
		submitLabel = 'Add',
		onSubmit,
		onCancel,
	}: Props = $props();

	let grams = $state<number>(initialGrams);
	let note = $state<string>(initialNote);

	const macros = $derived(macrosFromGrams(per100g, grams));

	function submit() {
		if (grams <= 0) return;
		onSubmit({ grams, note: note || undefined, macros });
	}
</script>

<div class="space-y-4">
	<div>
		<div class="text-sm text-text-secondary">Food</div>
		<div class="text-base text-text-primary font-medium">{name}</div>
	</div>

	<div>
		<label for="grams-input" class="block text-sm text-text-secondary mb-1">Grams</label>
		<NumberSpinner id="grams-input" bind:value={grams} min={1} step={10} />
	</div>

	<div class="grid grid-cols-4 gap-2 text-center text-sm">
		<div><div class="text-text-secondary">kcal</div><div class="font-medium">{macros.kcal}</div></div>
		<div><div class="text-text-secondary">P</div><div class="font-medium">{macros.protein}g</div></div>
		<div><div class="text-text-secondary">C</div><div class="font-medium">{macros.carbs}g</div></div>
		<div><div class="text-text-secondary">F</div><div class="font-medium">{macros.fat}g</div></div>
	</div>

	<div>
		<label for="note-input" class="block text-sm text-text-secondary mb-1">Note (optional)</label>
		<TextInput id="note-input" bind:value={note} />
	</div>

	<div class="flex gap-2 justify-end">
		{#if onCancel}
			<Button variant="ghost" onclick={onCancel}>Cancel</Button>
		{/if}
		<Button onclick={submit} disabled={grams <= 0}>{submitLabel}</Button>
	</div>
</div>
```

If `NumberSpinner` doesn't accept an `id` prop, change to a wrapped `<label>`. Verify against existing usage in `src/routes/(public)/exercises/new/+page.svelte` before adapting.

- [ ] **Step 2: Verify type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/FoodEntryForm.svelte
git commit -m "feat(nutrition): add FoodEntryForm component"
```

---

## Task 10: Settings → Profile route

**Files:**
- Create: `src/routes/(public)/settings/profile/+page.svelte`
- Modify: `src/routes/(public)/settings/+page.svelte`

- [ ] **Step 1: Implement `src/routes/(public)/settings/profile/+page.svelte`**

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import Card from '$lib/ui/Card.svelte';
	import NumberSpinner from '$lib/ui/NumberSpinner.svelte';
	import Select from '$lib/ui/Select.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { nutritionProfileStore } from '$lib/stores/nutritionProfile.svelte';
	import { computeTargets } from '$lib/nutrition/targets';
	import { latestWeightKg, upsertWeightForDate } from '$lib/nutrition/db';
	import { todayString } from '$lib/nutrition/dates';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { ActivityLevel, NutritionGoal, Sex } from '$lib/types';

	let kg = $state<number>(80);
	let saving = $state(false);

	onMount(async () => {
		await nutritionProfileStore.load();
		const w = await latestWeightKg();
		if (w !== null) kg = w;
	});

	const targets = $derived(computeTargets(nutritionProfileStore.snapshot(), kg));

	const sexOptions: { value: Sex; label: string }[] = [
		{ value: 'male', label: 'Male' },
		{ value: 'female', label: 'Female' },
	];
	const activityOptions: { value: ActivityLevel; label: string }[] = [
		{ value: 'sedentary', label: 'Sedentary' },
		{ value: 'light', label: 'Light' },
		{ value: 'moderate', label: 'Moderate' },
		{ value: 'active', label: 'Active' },
		{ value: 'very_active', label: 'Very active' },
	];
	const goalOptions: { value: NutritionGoal; label: string }[] = [
		{ value: 'cut', label: 'Cut (-500 kcal)' },
		{ value: 'maintain', label: 'Maintain' },
		{ value: 'bulk', label: 'Bulk (+300 kcal)' },
	];

	async function save() {
		saving = true;
		try {
			await nutritionProfileStore.save();
			await upsertWeightForDate(todayString(), kg);
			toastStore.showSuccess('Profile saved');
		} catch (e) {
			toastStore.showError('Failed to save profile');
			console.error(e);
		} finally {
			saving = false;
		}
	}

	function override(field: 'kcal' | 'protein' | 'carbs' | 'fat', value: number | null) {
		const next = { ...nutritionProfileStore.manualOverrides };
		if (value === null || Number.isNaN(value)) delete next[field];
		else next[field] = value;
		nutritionProfileStore.manualOverrides = next;
	}
</script>

<PageHeader title="Profile & Targets" backHref="/settings" />

<div class="max-w-xl mx-auto px-4 space-y-4 pb-24">
	<Card>
		<h2 class="text-lg font-semibold mb-4">Body</h2>
		<div class="grid grid-cols-2 gap-4">
			<label class="block">
				<span class="block text-sm text-text-secondary mb-1">Height (cm)</span>
				<NumberSpinner bind:value={nutritionProfileStore.heightCm} min={120} max={230} step={1} />
			</label>
			<label class="block">
				<span class="block text-sm text-text-secondary mb-1">Age</span>
				<NumberSpinner bind:value={nutritionProfileStore.age} min={10} max={100} step={1} />
			</label>
			<label class="block col-span-2">
				<span class="block text-sm text-text-secondary mb-1">Weight today (kg)</span>
				<NumberSpinner bind:value={kg} min={30} max={250} step={0.1} />
			</label>
			<label class="block">
				<span class="block text-sm text-text-secondary mb-1">Sex</span>
				<Select bind:value={nutritionProfileStore.sex} options={sexOptions} />
			</label>
			<label class="block">
				<span class="block text-sm text-text-secondary mb-1">Activity</span>
				<Select bind:value={nutritionProfileStore.activityLevel} options={activityOptions} />
			</label>
			<label class="block col-span-2">
				<span class="block text-sm text-text-secondary mb-1">Goal</span>
				<Select bind:value={nutritionProfileStore.goal} options={goalOptions} />
			</label>
			<label class="block col-span-2">
				<span class="block text-sm text-text-secondary mb-1">Protein (g per kg bodyweight)</span>
				<NumberSpinner bind:value={nutritionProfileStore.proteinPerKg} min={1.2} max={3.0} step={0.1} />
			</label>
		</div>
	</Card>

	<Card>
		<h2 class="text-lg font-semibold mb-4">Computed daily targets</h2>
		<div class="grid grid-cols-2 gap-4">
			{#each [['kcal', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g']] as [key, label, unit]}
				<label class="block">
					<span class="block text-sm text-text-secondary mb-1">{label} ({unit})</span>
					<NumberSpinner
						value={nutritionProfileStore.manualOverrides[key as 'kcal' | 'protein' | 'carbs' | 'fat'] ?? targets[key as 'kcal' | 'protein' | 'carbs' | 'fat']}
						onchange={(v) => override(key as 'kcal' | 'protein' | 'carbs' | 'fat', v)}
						min={0}
						step={key === 'kcal' ? 50 : 5}
					/>
					{#if nutritionProfileStore.manualOverrides[key as 'kcal' | 'protein' | 'carbs' | 'fat'] !== undefined}
						<button
							type="button"
							onclick={() => override(key as 'kcal' | 'protein' | 'carbs' | 'fat', null)}
							class="text-xs text-accent mt-1"
						>Reset to computed</button>
					{/if}
				</label>
			{/each}
		</div>
	</Card>

	<Button onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
</div>
```

If `NumberSpinner` does not support an `onchange` callback as written, adapt to bind:value plus an `$effect` that calls `override`. Confirm against `NumberSpinner.svelte` props.

- [ ] **Step 2: Add link to Profile from Settings**

In `src/routes/(public)/settings/+page.svelte`, locate the existing list of settings links and add an entry pointing to `/settings/profile` labelled "Profile & targets". Match the style of the surrounding entries.

- [ ] **Step 3: Verify type-check + manual smoke**

Run: `npm run check`
Then: `npm run dev` → visit `/settings/profile` → fill in fields → save → confirm toast → reload → values persist.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(public)/settings/profile/+page.svelte src/routes/(public)/settings/+page.svelte
git commit -m "feat(nutrition): add profile and targets settings page"
```

---

## Task 11: Add "Log" tab to Navigation

**Files:**
- Modify: `src/lib/components/Navigation.svelte`

- [ ] **Step 1: Add Log icon import + nav entry**

Replace:

```typescript
import {
    Home,
    Dumbbell,
    BarChart3,
    Settings
} from 'lucide-svelte';

const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/exercises', label: 'Exercises', icon: Dumbbell },
    { path: '/progress', label: 'Progress', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings }
];
```

with:

```typescript
import {
    Home,
    Dumbbell,
    NotebookPen,
    BarChart3,
    Settings
} from 'lucide-svelte';

const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/exercises', label: 'Exercises', icon: Dumbbell },
    { path: '/log', label: 'Log', icon: NotebookPen },
    { path: '/progress', label: 'Progress', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings }
];
```

- [ ] **Step 2: Extend `isActive` to recognize `/log` subroutes**

Inside `isActive`, before the final `return`, add:

```typescript
if (path === '/log') {
    return currentPath === '/log' || currentPath.startsWith('/log/');
}
```

- [ ] **Step 3: Verify type-check + visual smoke**

Run: `npm run check`
Then `npm run dev` → confirm 5 tabs appear (mobile + desktop) with Log between Exercises and Progress.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Navigation.svelte
git commit -m "feat(nav): add Log tab"
```

---

## Task 12: Log route — manual entry path

**Files:**
- Create: `src/routes/(public)/log/+page.svelte`

This task lands the Log page with manual food entry only (no Livs, no scan yet). Search and scan come in later tasks. Workout-start UI is intentionally **deferred** — for MVP the Log page is nutrition-only; we'll fold the workout entry under a single hub during the rebrand spec.

- [ ] **Step 1: Implement `src/routes/(public)/log/+page.svelte`**

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Trash2 } from 'lucide-svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import Card from '$lib/ui/Card.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import NumberSpinner from '$lib/ui/NumberSpinner.svelte';
	import DateNavigator from '$lib/components/DateNavigator.svelte';
	import MacroRings from '$lib/components/MacroRings.svelte';
	import FoodEntryForm from '$lib/components/FoodEntryForm.svelte';
	import {
		listEntriesForDate,
		dailyTotals,
		addEntry,
		deleteEntry,
		latestWeightKg,
	} from '$lib/nutrition/db';
	import { computeTargets } from '$lib/nutrition/targets';
	import { nutritionProfileStore } from '$lib/stores/nutritionProfile.svelte';
	import { todayString } from '$lib/nutrition/dates';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { FoodEntry, FoodMacros } from '$lib/types';

	let date = $state<string>(todayString());
	let entries = $state<FoodEntry[]>([]);
	let totals = $state<FoodMacros>({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
	let kg = $state<number>(80);

	let manualOpen = $state(false);
	let manualName = $state('');
	let manualPer100g = $state<FoodMacros>({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

	const targets = $derived(computeTargets(nutritionProfileStore.snapshot(), kg));

	async function refresh() {
		entries = await listEntriesForDate(date);
		totals = await dailyTotals(date);
	}

	$effect(() => { refresh(); });

	onMount(async () => {
		await nutritionProfileStore.load();
		const w = await latestWeightKg();
		if (w !== null) kg = w;
	});

	async function saveManual({ grams, note, macros }: { grams: number; note?: string; macros: FoodMacros }) {
		if (!manualName.trim()) {
			toastStore.showError('Enter a food name');
			return;
		}
		await addEntry({
			date,
			loggedAt: new Date().toISOString(),
			inlineFood: { name: manualName.trim(), per100g: manualPer100g },
			grams,
			macros,
			note,
		});
		manualOpen = false;
		manualName = '';
		manualPer100g = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
		await refresh();
		toastStore.showSuccess('Entry added');
	}

	async function remove(entry: FoodEntry) {
		await deleteEntry(entry.id);
		await refresh();
	}

	function entryName(e: FoodEntry): string {
		return e.inlineFood?.name ?? 'Saved food';
	}
</script>

<PageHeader title="Log" />

<div class="max-w-2xl mx-auto px-4 space-y-4 pb-24">
	<DateNavigator {date} onChange={(d) => date = d} />

	<Card>
		<MacroRings current={totals} target={targets} />
	</Card>

	<div class="flex justify-end">
		<Button onclick={() => manualOpen = true}>
			<Plus class="w-4 h-4" /> Add entry
		</Button>
	</div>

	<Card>
		{#if entries.length === 0}
			<p class="text-sm text-text-secondary text-center py-6">No entries for this day yet.</p>
		{:else}
			<ul class="divide-y divide-border">
				{#each entries as entry (entry.id)}
					<li class="flex items-center justify-between py-3">
						<div>
							<div class="text-text-primary font-medium">{entryName(entry)}</div>
							<div class="text-xs text-text-secondary">
								{entry.grams}g · {entry.macros.kcal}kcal · {entry.macros.protein}g P
								{#if entry.note}· {entry.note}{/if}
							</div>
						</div>
						<button
							type="button"
							class="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"
							onclick={() => remove(entry)}
							aria-label="Delete entry"
						>
							<Trash2 class="w-4 h-4" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</div>

<Modal bind:open={manualOpen} title="Add food (manual)">
	<div class="space-y-4">
		<label class="block">
			<span class="block text-sm text-text-secondary mb-1">Name</span>
			<TextInput bind:value={manualName} />
		</label>
		<div class="grid grid-cols-4 gap-2">
			{#each [['kcal', 'kcal'], ['protein', 'P'], ['carbs', 'C'], ['fat', 'F']] as [key, label]}
				<label class="block">
					<span class="block text-xs text-text-secondary mb-1">{label}/100g</span>
					<NumberSpinner
						value={manualPer100g[key as 'kcal' | 'protein' | 'carbs' | 'fat']}
						onchange={(v) => manualPer100g = { ...manualPer100g, [key]: v }}
						min={0}
						step={1}
					/>
				</label>
			{/each}
		</div>
		<FoodEntryForm
			name={manualName || 'New food'}
			per100g={manualPer100g}
			submitLabel="Add"
			onSubmit={saveManual}
			onCancel={() => manualOpen = false}
		/>
	</div>
</Modal>
```

- [ ] **Step 2: Verify type-check + manual smoke**

Run: `npm run check`
Then `npm run dev` → visit `/log` → date navigator works → "Add entry" opens modal → fill name + per-100g + grams → save → entry appears, totals update → delete works → switching dates shows different entries.

- [ ] **Step 3: Commit**

```bash
git add src/routes/(public)/log/+page.svelte
git commit -m "feat(nutrition): add Log page with manual entry"
```

---

## Task 13: Livsmedelsverket build script

**Files:**
- Create: `scripts/build-livs.ts`
- Create: `data/livs-source/README.md`
- Create: `static/livs-foods.json` (committed artifact)
- Modify: `package.json`

**License gate** — before this task, verify Livsmedelsverket dataset license permits redistribution + bundling. If not, branch to fallback: build from Open Food Facts Swedish subset instead. The script structure below is source-agnostic — adapt the `parseSource` function to the actual format.

- [ ] **Step 1: Document the source**

Create `data/livs-source/README.md`:

```markdown
# Livsmedelsverket source

Place the upstream dataset (CSV/Excel) downloaded from livsmedelsverket.se here.
Expected file: `livsmedelsdatabasen.csv` (or whatever the current export is named).

Re-run `npm run build:livs` after updating the source.

License: <fill in after verification — must permit redistribution>.
```

- [ ] **Step 2: Implement `scripts/build-livs.ts`**

```typescript
/**
 * Reads upstream Livsmedelsverket data and writes a normalized JSON for the app.
 * Fields: { id, name, per100g: { kcal, protein, carbs, fat }, servingSize? }
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface NormalizedFood {
	id: string;
	name: string;
	per100g: { kcal: number; protein: number; carbs: number; fat: number };
}

const SOURCE_DIR = join(process.cwd(), 'data/livs-source');
const OUT_PATH = join(process.cwd(), 'static/livs-foods.json');

function parseSource(): NormalizedFood[] {
	// Adapt to actual CSV columns / Excel sheet names from upstream.
	// Expected canonical input: CSV with headers including
	//   Number, Name, Energy (kcal/100g), Protein (g/100g), Carbohydrate (g/100g), Fat (g/100g)
	const csvPath = join(SOURCE_DIR, 'livsmedelsdatabasen.csv');
	if (!existsSync(csvPath)) {
		console.warn(`[build-livs] Source not found at ${csvPath}; writing empty bundle.`);
		return [];
	}
	const raw = readFileSync(csvPath, 'utf8');
	const lines = raw.split(/\r?\n/).filter(Boolean);
	const header = lines.shift();
	if (!header) return [];

	// Tolerant column resolver (case-insensitive, partial match)
	const cols = header.split(';');
	const findCol = (needle: string) =>
		cols.findIndex((c) => c.toLowerCase().includes(needle));
	const idIdx = findCol('number');
	const nameIdx = findCol('namn');
	const kcalIdx = findCol('energi');
	const proteinIdx = findCol('protein');
	const carbsIdx = findCol('kolhydrater');
	const fatIdx = findCol('fett');

	if ([idIdx, nameIdx, kcalIdx, proteinIdx, carbsIdx, fatIdx].some((i) => i < 0)) {
		throw new Error('[build-livs] Could not resolve required columns. Update parseSource.');
	}

	const out: NormalizedFood[] = [];
	for (const line of lines) {
		const cells = line.split(';');
		const id = (cells[idIdx] ?? '').trim();
		const name = (cells[nameIdx] ?? '').trim();
		const num = (s: string) => Number(String(s ?? '').replace(',', '.').trim()) || 0;
		if (!id || !name) continue;
		out.push({
			id: `livs-${id}`,
			name,
			per100g: {
				kcal: num(cells[kcalIdx]),
				protein: num(cells[proteinIdx]),
				carbs: num(cells[carbsIdx]),
				fat: num(cells[fatIdx]),
			},
		});
	}
	return out;
}

const foods = parseSource();
writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), foods }));
console.log(`[build-livs] Wrote ${foods.length} foods to ${OUT_PATH}`);
```

- [ ] **Step 3: Wire build script into `package.json`**

In `scripts`, add:

```json
"build:livs": "tsx scripts/build-livs.ts",
"prepare": "svelte-kit sync && npm run build:livs || echo ''"
```

(Replace the existing `prepare` line. The `|| echo ''` keeps prepare non-fatal during install.)

Add dev dep:

```bash
npm install --save-dev tsx
```

- [ ] **Step 4: Run script + verify output exists**

Run: `npm run build:livs`
Expected: prints either an entry count or a "source not found, writing empty bundle" warning. Either way, `static/livs-foods.json` exists.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-livs.ts data/livs-source/README.md static/livs-foods.json package.json package-lock.json
git commit -m "feat(nutrition): add Livsmedelsverket build script"
```

---

## Task 14: Livs loader + search (TDD)

**Files:**
- Create: `src/lib/nutrition/livs.ts`
- Test:   `src/lib/nutrition/livs.test.ts`

- [ ] **Step 1: Write failing tests in `src/lib/nutrition/livs.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { searchLivs, _setBundleForTests } from './livs';

const sample = [
	{ id: 'livs-1', name: 'Havregryn', per100g: { kcal: 370, protein: 13, carbs: 60, fat: 7 } },
	{ id: 'livs-2', name: 'Ägg, kokt', per100g: { kcal: 155, protein: 13, carbs: 1, fat: 11 } },
	{ id: 'livs-3', name: 'Kycklingbröst', per100g: { kcal: 110, protein: 23, carbs: 0, fat: 2 } },
];

describe('searchLivs', () => {
	beforeEach(() => { _setBundleForTests(sample); });

	it('substring match, case-insensitive', () => {
		const r = searchLivs('havre');
		expect(r.length).toBe(1);
		expect(r[0].name).toBe('Havregryn');
	});

	it('matches Swedish characters', () => {
		const r = searchLivs('ägg');
		expect(r[0].name).toContain('Ägg');
	});

	it('returns empty for empty query', () => {
		expect(searchLivs('')).toEqual([]);
	});

	it('caps results at limit', () => {
		const r = searchLivs('e', 1);
		expect(r.length).toBe(1);
	});
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm run test:run -- src/lib/nutrition/livs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/nutrition/livs.ts`**

```typescript
import type { FoodMacros } from '$lib/types';

export interface LivsFood {
	id: string;
	name: string;
	per100g: FoodMacros;
}

let cache: LivsFood[] | null = null;
let loadPromise: Promise<LivsFood[]> | null = null;

async function loadBundle(): Promise<LivsFood[]> {
	if (cache) return cache;
	if (loadPromise) return loadPromise;
	loadPromise = fetch('/livs-foods.json')
		.then((r) => {
			if (!r.ok) throw new Error('Failed to load livs bundle');
			return r.json() as Promise<{ foods: LivsFood[] }>;
		})
		.then((data) => {
			cache = data.foods;
			return cache;
		});
	return loadPromise;
}

export async function loadLivs(): Promise<LivsFood[]> {
	return loadBundle();
}

export function searchLivs(query: string, limit = 20): LivsFood[] {
	if (!cache) return []; // call loadLivs first; sync API for hot search after preload
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const results: LivsFood[] = [];
	for (const f of cache) {
		if (f.name.toLowerCase().includes(q)) {
			results.push(f);
			if (results.length >= limit) break;
		}
	}
	return results;
}

/** test-only */
export function _setBundleForTests(foods: LivsFood[]): void {
	cache = foods;
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm run test:run -- src/lib/nutrition/livs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nutrition/livs.ts src/lib/nutrition/livs.test.ts
git commit -m "feat(nutrition): add Livsmedelsverket loader and search"
```

---

## Task 15: FoodSearch component

**Files:**
- Create: `src/lib/components/FoodSearch.svelte`

Combines saved-foods (priority) + Livs (fallback). Emits `onPick` with a unified shape.

- [ ] **Step 1: Implement `src/lib/components/FoodSearch.svelte`**

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import SearchInput from '$lib/ui/SearchInput.svelte';
	import { searchSavedFoods } from '$lib/nutrition/db';
	import { loadLivs, searchLivs, type LivsFood } from '$lib/nutrition/livs';
	import type { Food, FoodMacros } from '$lib/types';

	export interface PickedFood {
		source: 'saved' | 'livs';
		name: string;
		per100g: FoodMacros;
		savedFoodId?: string;
		livsId?: string;
	}

	interface Props {
		onPick: (food: PickedFood) => void;
	}

	const { onPick }: Props = $props();

	let query = $state('');
	let saved = $state<Food[]>([]);
	let livs = $state<LivsFood[]>([]);

	onMount(async () => {
		await loadLivs();
	});

	$effect(() => {
		const q = query;
		(async () => {
			saved = await searchSavedFoods(q, 8);
			livs = q.trim() ? searchLivs(q, 12) : [];
		})();
	});

	function pickSaved(f: Food) {
		onPick({ source: 'saved', name: f.name, per100g: f.per100g, savedFoodId: f.id });
	}

	function pickLivs(f: LivsFood) {
		onPick({ source: 'livs', name: f.name, per100g: f.per100g, livsId: f.id });
	}
</script>

<div class="space-y-3">
	<SearchInput bind:value={query} placeholder="Search foods…" />

	{#if saved.length > 0}
		<div>
			<div class="text-xs uppercase tracking-wide text-text-secondary mb-1">Saved</div>
			<ul class="divide-y divide-border rounded-lg bg-surface">
				{#each saved as f (f.id)}
					<li>
						<button type="button" class="w-full text-left p-3 hover:bg-surface-hover" onclick={() => pickSaved(f)}>
							<div class="font-medium">{f.name}{#if f.brand} <span class="text-text-secondary text-xs">({f.brand})</span>{/if}</div>
							<div class="text-xs text-text-secondary">{f.per100g.kcal}kcal · {f.per100g.protein}g P /100g</div>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if livs.length > 0}
		<div>
			<div class="text-xs uppercase tracking-wide text-text-secondary mb-1">Livsmedelsverket</div>
			<ul class="divide-y divide-border rounded-lg bg-surface">
				{#each livs as f (f.id)}
					<li>
						<button type="button" class="w-full text-left p-3 hover:bg-surface-hover" onclick={() => pickLivs(f)}>
							<div class="font-medium">{f.name}</div>
							<div class="text-xs text-text-secondary">{f.per100g.kcal}kcal · {f.per100g.protein}g P /100g</div>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if query.trim() && saved.length === 0 && livs.length === 0}
		<p class="text-sm text-text-secondary text-center py-3">No matches.</p>
	{/if}
</div>
```

- [ ] **Step 2: Verify type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/FoodSearch.svelte
git commit -m "feat(nutrition): add FoodSearch component"
```

---

## Task 16: Wire FoodSearch into Log page

**Files:**
- Modify: `src/routes/(public)/log/+page.svelte`

- [ ] **Step 1: Replace the existing manual modal flow with a unified add flow**

The Log page should now offer two paths inside one Add modal:
1. Search-and-pick (default — uses FoodSearch).
2. Manual food (a small "Manual entry" toggle).

Replace the manual-only modal in Task 12 with the structure below. Keep imports + state from Task 12; add new ones as needed.

Add imports:

```typescript
import FoodSearch, { type PickedFood } from '$lib/components/FoodSearch.svelte';
import Toggle from '$lib/ui/Toggle.svelte';
import { addFood, getFoodById, touchFood } from '$lib/nutrition/db';
```

Replace state block (in addition to existing):

```typescript
let addOpen = $state(false);
let mode = $state<'search' | 'manual'>('search');
let pickedName = $state('');
let pickedPer100g = $state<FoodMacros>({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
let pickedFoodId = $state<string | undefined>(undefined);
let pickedLivsId = $state<string | undefined>(undefined);
let saveToLibrary = $state<boolean>(true);
```

Replace the previous "Add entry" button + Modal markup with:

```svelte
<div class="flex justify-end">
	<Button onclick={() => { addOpen = true; mode = 'search'; resetPick(); }}>
		<Plus class="w-4 h-4" /> Add entry
	</Button>
</div>

<Modal bind:open={addOpen} title="Add food">
	<div class="space-y-4">
		<div class="flex gap-2 text-sm">
			<button class="px-3 py-1 rounded-lg {mode === 'search' ? 'bg-accent text-bg' : 'bg-surface'}" onclick={() => mode = 'search'}>Search</button>
			<button class="px-3 py-1 rounded-lg {mode === 'manual' ? 'bg-accent text-bg' : 'bg-surface'}" onclick={() => mode = 'manual'}>Manual</button>
		</div>

		{#if mode === 'search'}
			{#if !pickedName}
				<FoodSearch onPick={onSearchPick} />
			{:else}
				<FoodEntryForm
					name={pickedName}
					per100g={pickedPer100g}
					submitLabel="Add"
					onSubmit={onSearchSubmit}
					onCancel={resetPick}
				/>
			{/if}
		{:else}
			<label class="block">
				<span class="block text-sm text-text-secondary mb-1">Name</span>
				<TextInput bind:value={pickedName} />
			</label>
			<div class="grid grid-cols-4 gap-2">
				{#each [['kcal', 'kcal'], ['protein', 'P'], ['carbs', 'C'], ['fat', 'F']] as [key, label]}
					<label class="block">
						<span class="block text-xs text-text-secondary mb-1">{label}/100g</span>
						<NumberSpinner
							value={pickedPer100g[key as 'kcal' | 'protein' | 'carbs' | 'fat']}
							onchange={(v) => pickedPer100g = { ...pickedPer100g, [key]: v }}
							min={0}
							step={1}
						/>
					</label>
				{/each}
			</div>
			<label class="flex items-center gap-2 text-sm">
				<Toggle bind:checked={saveToLibrary} /> Save to library
			</label>
			<FoodEntryForm
				name={pickedName || 'New food'}
				per100g={pickedPer100g}
				submitLabel="Add"
				onSubmit={onManualSubmit}
				onCancel={() => addOpen = false}
			/>
		{/if}
	</div>
</Modal>
```

Add functions:

```typescript
function resetPick() {
	pickedName = '';
	pickedPer100g = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
	pickedFoodId = undefined;
	pickedLivsId = undefined;
}

function onSearchPick(picked: PickedFood) {
	pickedName = picked.name;
	pickedPer100g = picked.per100g;
	pickedFoodId = picked.savedFoodId;
	pickedLivsId = picked.livsId;
}

async function onSearchSubmit({ grams, note, macros }: { grams: number; note?: string; macros: FoodMacros }) {
	let foodId = pickedFoodId;
	// Promote a Livs pick to the saved-foods library (idempotent on lastUsedAt).
	if (!foodId && pickedLivsId) {
		foodId = await addFood({
			source: 'livs',
			externalId: pickedLivsId,
			name: pickedName,
			per100g: pickedPer100g,
			lastUsedAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
		});
	} else if (foodId) {
		await touchFood(foodId);
	}
	await addEntry({
		date,
		loggedAt: new Date().toISOString(),
		foodId,
		grams,
		macros,
		note,
	});
	addOpen = false;
	resetPick();
	await refresh();
	toastStore.showSuccess('Entry added');
}

async function onManualSubmit({ grams, note, macros }: { grams: number; note?: string; macros: FoodMacros }) {
	if (!pickedName.trim()) {
		toastStore.showError('Enter a food name');
		return;
	}
	let foodId: string | undefined;
	if (saveToLibrary) {
		foodId = await addFood({
			source: 'custom',
			name: pickedName.trim(),
			per100g: pickedPer100g,
			lastUsedAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
		});
	}
	await addEntry({
		date,
		loggedAt: new Date().toISOString(),
		foodId,
		inlineFood: foodId ? undefined : { name: pickedName.trim(), per100g: pickedPer100g },
		grams,
		macros,
		note,
	});
	addOpen = false;
	resetPick();
	await refresh();
	toastStore.showSuccess('Entry added');
}
```

Update `entryName(e)` so saved-food entries display the food name. Resolve via `foodId`:

```typescript
let nameById = $state<Map<string, string>>(new Map());
async function refresh() {
	entries = await listEntriesForDate(date);
	totals = await dailyTotals(date);
	const ids = [...new Set(entries.map((e) => e.foodId).filter(Boolean) as string[])];
	const map = new Map<string, string>();
	for (const id of ids) {
		const f = await getFoodById(id);
		if (f) map.set(id, f.name);
	}
	nameById = map;
}
function entryName(e: FoodEntry): string {
	if (e.foodId) return nameById.get(e.foodId) ?? 'Saved food';
	return e.inlineFood?.name ?? 'Entry';
}
```

- [ ] **Step 2: Type-check + manual smoke**

Run: `npm run check`
Then `npm run dev` → /log → Add → search "havre" (after build:livs has populated bundle, otherwise expect empty Livs). Verify saved foods rank above Livs after first use.

- [ ] **Step 3: Commit**

```bash
git add src/routes/(public)/log/+page.svelte
git commit -m "feat(nutrition): add search-driven entry on Log page"
```

---

## Task 17: Open Food Facts client (TDD)

**Files:**
- Create: `src/lib/nutrition/off.ts`
- Test:   `src/lib/nutrition/off.test.ts`

OFF endpoint: `https://world.openfoodfacts.org/api/v2/product/<barcode>.json` → returns `{ status, product: { product_name, brands, nutriments: { 'energy-kcal_100g', proteins_100g, carbohydrates_100g, fat_100g }, serving_size, ... } }`.

- [ ] **Step 1: Write failing tests in `src/lib/nutrition/off.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchOffProduct, normalizeOffProduct } from './off';

describe('normalizeOffProduct', () => {
	it('reads kcal + macros from nutriments', () => {
		const out = normalizeOffProduct('7311070000000', {
			product_name: 'Test Yogurt',
			brands: 'Arla',
			nutriments: {
				'energy-kcal_100g': 60,
				proteins_100g: 4,
				carbohydrates_100g: 6,
				fat_100g: 2,
			},
		});
		expect(out).toEqual({
			barcode: '7311070000000',
			name: 'Test Yogurt',
			brand: 'Arla',
			per100g: { kcal: 60, protein: 4, carbs: 6, fat: 2 },
		});
	});

	it('falls back to energy_100g (kJ) divided by 4.184 when no kcal field', () => {
		const out = normalizeOffProduct('123', {
			product_name: 'X',
			nutriments: { energy_100g: 418.4, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 },
		});
		expect(out.per100g.kcal).toBe(100);
	});

	it('returns zeros if nutriments missing', () => {
		const out = normalizeOffProduct('123', { product_name: 'Y' });
		expect(out.per100g).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
	});
});

describe('fetchOffProduct', () => {
	beforeEach(() => { vi.restoreAllMocks(); });

	it('returns null when status !== 1', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ status: 0 }),
		}));
		expect(await fetchOffProduct('000')).toBeNull();
	});

	it('returns normalized product when status === 1', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				status: 1,
				product: {
					product_name: 'Yog',
					brands: 'Arla',
					nutriments: { 'energy-kcal_100g': 60, proteins_100g: 4, carbohydrates_100g: 6, fat_100g: 2 },
				},
			}),
		}));
		const r = await fetchOffProduct('7311');
		expect(r?.name).toBe('Yog');
		expect(r?.per100g.kcal).toBe(60);
	});

	it('throws on network error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		await expect(fetchOffProduct('123')).rejects.toThrow();
	});
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm run test:run -- src/lib/nutrition/off.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/nutrition/off.ts`**

```typescript
import type { FoodMacros } from '$lib/types';

export interface OffNormalized {
	barcode: string;
	name: string;
	brand?: string;
	per100g: FoodMacros;
}

interface OffProductRaw {
	product_name?: string;
	brands?: string;
	nutriments?: Record<string, number>;
}

interface OffResponse {
	status: 0 | 1;
	product?: OffProductRaw;
}

export function normalizeOffProduct(barcode: string, p: OffProductRaw): OffNormalized {
	const n = p.nutriments ?? {};
	let kcal = Number(n['energy-kcal_100g'] ?? 0);
	if (!kcal && n.energy_100g) kcal = Math.round(Number(n.energy_100g) / 4.184);
	return {
		barcode,
		name: p.product_name?.trim() || `Barcode ${barcode}`,
		brand: p.brands?.split(',')[0]?.trim() || undefined,
		per100g: {
			kcal: Math.round(kcal),
			protein: Number(n.proteins_100g ?? 0),
			carbs: Number(n.carbohydrates_100g ?? 0),
			fat: Number(n.fat_100g ?? 0),
		},
	};
}

export async function fetchOffProduct(barcode: string): Promise<OffNormalized | null> {
	const res = await fetch(
		`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
		{ headers: { 'User-Agent': 'GymTrack-Nutrition/1.0' } },
	);
	if (!res.ok) throw new Error(`OFF responded ${res.status}`);
	const data = (await res.json()) as OffResponse;
	if (data.status !== 1 || !data.product) return null;
	return normalizeOffProduct(barcode, data.product);
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm run test:run -- src/lib/nutrition/off.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nutrition/off.ts src/lib/nutrition/off.test.ts
git commit -m "feat(nutrition): add Open Food Facts client"
```

---

## Task 18: Barcode scanner module (BarcodeDetector + zxing fallback)

**Files:**
- Create: `src/lib/nutrition/scanner.ts`
- Modify: `package.json`

- [ ] **Step 1: Install `@zxing/browser`**

Run: `npm install @zxing/browser`

- [ ] **Step 2: Implement `src/lib/nutrition/scanner.ts`**

```typescript
export interface ScanController {
	stop: () => void;
}

export type ScanResult = { barcode: string; format?: string };

declare global {
	interface Window {
		BarcodeDetector?: {
			new (options?: { formats?: string[] }): {
				detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string; format: string }>>;
			};
		};
	}
}

export function isBarcodeDetectorSupported(): boolean {
	return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function';
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

async function startWithBarcodeDetector(
	video: HTMLVideoElement,
	onResult: (r: ScanResult) => void,
): Promise<ScanController> {
	const Detector = window.BarcodeDetector!;
	const detector = new Detector({ formats: FORMATS });
	let stopped = false;
	const tick = async () => {
		if (stopped) return;
		try {
			const results = await detector.detect(video);
			if (results.length > 0) {
				onResult({ barcode: results[0].rawValue, format: results[0].format });
				return;
			}
		} catch {
			// ignore frame errors
		}
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
	return { stop: () => { stopped = true; } };
}

async function startWithZxing(
	video: HTMLVideoElement,
	onResult: (r: ScanResult) => void,
): Promise<ScanController> {
	const { BrowserMultiFormatReader } = await import('@zxing/browser');
	const reader = new BrowserMultiFormatReader();
	const controls = await reader.decodeFromVideoElement(video, (result) => {
		if (result) {
			onResult({ barcode: result.getText(), format: 'zxing' });
		}
	});
	return { stop: () => controls.stop() };
}

export async function startScanner(
	video: HTMLVideoElement,
	onResult: (r: ScanResult) => void,
): Promise<ScanController> {
	const stream = await navigator.mediaDevices.getUserMedia({
		video: { facingMode: 'environment' },
		audio: false,
	});
	video.srcObject = stream;
	await video.play();

	const inner = isBarcodeDetectorSupported()
		? await startWithBarcodeDetector(video, onResult)
		: await startWithZxing(video, onResult);

	return {
		stop: () => {
			inner.stop();
			stream.getTracks().forEach((t) => t.stop());
		},
	};
}
```

- [ ] **Step 3: Verify type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/nutrition/scanner.ts package.json package-lock.json
git commit -m "feat(nutrition): add barcode scanner module"
```

---

## Task 19: BarcodeScanner component

**Files:**
- Create: `src/lib/components/BarcodeScanner.svelte`

- [ ] **Step 1: Implement `src/lib/components/BarcodeScanner.svelte`**

```svelte
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { startScanner, type ScanController } from '$lib/nutrition/scanner';

	interface Props {
		onScan: (barcode: string) => void;
		onError?: (e: unknown) => void;
	}

	const { onScan, onError }: Props = $props();

	let video: HTMLVideoElement | null = $state(null);
	let controller: ScanController | null = null;
	let error = $state<string | null>(null);

	onMount(async () => {
		if (!video) return;
		try {
			controller = await startScanner(video, (r) => {
				onScan(r.barcode);
			});
		} catch (e) {
			error = e instanceof Error ? e.message : 'Camera unavailable';
			onError?.(e);
		}
	});

	onDestroy(() => controller?.stop());
</script>

<div class="relative w-full bg-black aspect-[3/4] rounded-lg overflow-hidden">
	<!-- svelte-ignore a11y_media_has_caption -->
	<video bind:this={video} class="w-full h-full object-cover" muted playsinline></video>
	<div class="absolute inset-0 pointer-events-none flex items-center justify-center">
		<div class="w-3/4 h-1/3 border-2 border-accent/80 rounded-lg"></div>
	</div>
	{#if error}
		<div class="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-text-primary">
			{error}
		</div>
	{/if}
</div>
```

- [ ] **Step 2: Verify type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/BarcodeScanner.svelte
git commit -m "feat(nutrition): add BarcodeScanner component"
```

---

## Task 20: Scan route + wire to Log

**Files:**
- Create: `src/routes/(public)/log/scan/+page.svelte`
- Modify: `src/routes/(public)/log/+page.svelte`

The scanner is a route (full-screen experience) rather than an inline modal — easier to manage camera lifecycle and back-button. After a successful scan, store the `OffNormalized` (or "not found" flag) in `sessionStorage` and navigate back to `/log`, which picks up the data and opens the entry form.

- [ ] **Step 1: Implement `src/routes/(public)/log/scan/+page.svelte`**

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
	import { findFoodByBarcode } from '$lib/nutrition/db';
	import { fetchOffProduct } from '$lib/nutrition/off';
	import { toastStore } from '$lib/stores/toast.svelte';

	const HANDOFF_KEY = 'gym-app-scan-handoff';

	let busy = $state(false);

	async function onBarcode(barcode: string) {
		if (busy) return;
		busy = true;

		// 1. Look in already-saved foods.
		const saved = await findFoodByBarcode(barcode);
		if (saved) {
			sessionStorage.setItem(
				HANDOFF_KEY,
				JSON.stringify({ kind: 'saved', foodId: saved.id, name: saved.name, per100g: saved.per100g }),
			);
			goto('/log');
			return;
		}

		// 2. Try Open Food Facts.
		try {
			const off = await fetchOffProduct(barcode);
			if (off) {
				sessionStorage.setItem(
					HANDOFF_KEY,
					JSON.stringify({ kind: 'off', barcode, name: off.name, brand: off.brand, per100g: off.per100g }),
				);
				goto('/log');
				return;
			}
			// Not found — pre-fill manual entry.
			sessionStorage.setItem(
				HANDOFF_KEY,
				JSON.stringify({ kind: 'manual', barcode }),
			);
			toastStore.showError('Product not found — enter it manually.');
			goto('/log');
		} catch {
			sessionStorage.setItem(
				HANDOFF_KEY,
				JSON.stringify({ kind: 'manual', barcode }),
			);
			toastStore.showError('Offline / lookup failed — enter it manually.');
			goto('/log');
		}
	}
</script>

<PageHeader title="Scan barcode" backHref="/log" />

<div class="max-w-md mx-auto px-4">
	<BarcodeScanner onScan={onBarcode} />
	<p class="text-center text-xs text-text-secondary mt-3">
		Point at a product barcode. Results auto-cache locally.
	</p>
</div>
```

- [ ] **Step 2: Add scan button to Log page + handoff handler**

In `src/routes/(public)/log/+page.svelte`:

1. Add scan button next to "Add entry":

```svelte
<div class="flex justify-end gap-2">
	<Button variant="ghost" onclick={() => goto('/log/scan')}>
		<Camera class="w-4 h-4" /> Scan
	</Button>
	<Button onclick={() => { addOpen = true; mode = 'search'; resetPick(); }}>
		<Plus class="w-4 h-4" /> Add entry
	</Button>
</div>
```

Add imports:

```typescript
import { goto } from '$app/navigation';
import { Camera } from 'lucide-svelte';
```

2. In `onMount`, after profile + weight load, check for scan handoff:

```typescript
const HANDOFF_KEY = 'gym-app-scan-handoff';

onMount(async () => {
	await nutritionProfileStore.load();
	const w = await latestWeightKg();
	if (w !== null) kg = w;

	const handoff = sessionStorage.getItem(HANDOFF_KEY);
	if (handoff) {
		sessionStorage.removeItem(HANDOFF_KEY);
		try {
			const data = JSON.parse(handoff) as
				| { kind: 'saved'; foodId: string; name: string; per100g: FoodMacros }
				| { kind: 'off'; barcode: string; name: string; brand?: string; per100g: FoodMacros }
				| { kind: 'manual'; barcode: string };
			openFromHandoff(data);
		} catch { /* ignore */ }
	}
});

let pendingOffBarcode: string | undefined;

function openFromHandoff(data: { kind: 'saved'; foodId: string; name: string; per100g: FoodMacros } | { kind: 'off'; barcode: string; name: string; brand?: string; per100g: FoodMacros } | { kind: 'manual'; barcode: string }) {
	addOpen = true;
	if (data.kind === 'saved') {
		mode = 'search';
		pickedName = data.name;
		pickedPer100g = data.per100g;
		pickedFoodId = data.foodId;
	} else if (data.kind === 'off') {
		mode = 'search';
		pickedName = data.name;
		pickedPer100g = data.per100g;
		pendingOffBarcode = data.barcode;
		pickedFoodId = undefined;
	} else {
		mode = 'manual';
		pickedName = `Barcode ${data.barcode}`;
		pickedPer100g = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
		pendingOffBarcode = data.barcode;
	}
}
```

3. Update `onSearchSubmit` to cache OFF results to `foods` on save:

```typescript
async function onSearchSubmit({ grams, note, macros }: { grams: number; note?: string; macros: FoodMacros }) {
	let foodId = pickedFoodId;
	if (!foodId && pendingOffBarcode) {
		foodId = await addFood({
			source: 'off',
			barcode: pendingOffBarcode,
			name: pickedName,
			per100g: pickedPer100g,
			lastUsedAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
		});
	} else if (!foodId && pickedLivsId) {
		foodId = await addFood({
			source: 'livs',
			externalId: pickedLivsId,
			name: pickedName,
			per100g: pickedPer100g,
			lastUsedAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
		});
	} else if (foodId) {
		await touchFood(foodId);
	}
	await addEntry({
		date,
		loggedAt: new Date().toISOString(),
		foodId,
		grams,
		macros,
		note,
	});
	addOpen = false;
	resetPick();
	pendingOffBarcode = undefined;
	await refresh();
	toastStore.showSuccess('Entry added');
}
```

4. Update `onManualSubmit` to attach the barcode when present:

```typescript
async function onManualSubmit({ grams, note, macros }: { grams: number; note?: string; macros: FoodMacros }) {
	if (!pickedName.trim()) {
		toastStore.showError('Enter a food name');
		return;
	}
	let foodId: string | undefined;
	if (saveToLibrary) {
		foodId = await addFood({
			source: 'custom',
			barcode: pendingOffBarcode,
			name: pickedName.trim(),
			per100g: pickedPer100g,
			lastUsedAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
		});
	}
	await addEntry({
		date,
		loggedAt: new Date().toISOString(),
		foodId,
		inlineFood: foodId ? undefined : { name: pickedName.trim(), per100g: pickedPer100g },
		grams,
		macros,
		note,
	});
	addOpen = false;
	resetPick();
	pendingOffBarcode = undefined;
	await refresh();
	toastStore.showSuccess('Entry added');
}
```

- [ ] **Step 3: Type-check + manual smoke**

Run: `npm run check`
Then on a phone (HTTPS or `npm run dev -- --host` + Chrome flag for camera over LAN-IP): /log → Scan → scan a Swedish supermarket product → returns to Log with OFF data pre-filled → save → next scan of same barcode is instant (cached).

- [ ] **Step 4: Commit**

```bash
git add src/routes/(public)/log/scan/+page.svelte src/routes/(public)/log/+page.svelte
git commit -m "feat(nutrition): add barcode scan flow with OFF cache"
```

---

## Task 21: Progress → Weight route

**Files:**
- Create: `src/routes/(public)/progress/weight/+page.svelte`
- Create: `src/lib/components/WeightChart.svelte`
- Modify: `src/routes/(public)/progress/+layout.svelte`

- [ ] **Step 1: Implement `src/lib/components/WeightChart.svelte`**

Use svelteplot (existing dep). Reference any existing chart file under `src/routes/(public)/progress/charts/` for the import + grammar pattern, then mirror it for a simple line of date→kg.

```svelte
<script lang="ts">
	import { Plot, Line, Dot, axisX, axisY } from 'svelteplot';
	import type { Weight } from '$lib/types';

	interface Props { data: Weight[]; }
	const { data }: Props = $props();

	const points = $derived(data.map((w) => ({ x: w.date, y: w.kg })));
</script>

{#if points.length === 0}
	<p class="text-sm text-text-secondary text-center py-6">No weight data yet.</p>
{:else}
	<Plot height={240} marginLeft={48} marginBottom={32}>
		{axisX()}
		{axisY()}
		<Line data={points} x="x" y="y" stroke="var(--color-accent)" />
		<Dot data={points} x="x" y="y" fill="var(--color-accent)" />
	</Plot>
{/if}
```

If svelteplot's API differs in the installed version, mirror the import + component shape used in `src/routes/(public)/progress/charts/+page.svelte` (the existing charts file is the source of truth for the grammar).

- [ ] **Step 2: Implement `src/routes/(public)/progress/weight/+page.svelte`**

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import Card from '$lib/ui/Card.svelte';
	import Button from '$lib/ui/Button.svelte';
	import NumberSpinner from '$lib/ui/NumberSpinner.svelte';
	import WeightChart from '$lib/components/WeightChart.svelte';
	import {
		listWeights,
		upsertWeightForDate,
		latestWeightKg,
	} from '$lib/nutrition/db';
	import { todayString } from '$lib/nutrition/dates';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { Weight } from '$lib/types';

	let kg = $state<number>(80);
	let weights = $state<Weight[]>([]);

	onMount(async () => {
		weights = await listWeights();
		const w = await latestWeightKg();
		if (w !== null) kg = w;
	});

	async function save() {
		await upsertWeightForDate(todayString(), kg);
		weights = await listWeights();
		toastStore.showSuccess('Weight saved');
	}
</script>

<PageHeader title="Weight" backHref="/progress" />

<div class="max-w-2xl mx-auto px-4 space-y-4 pb-24">
	<Card>
		<div class="flex items-end gap-3">
			<label class="block flex-1">
				<span class="block text-sm text-text-secondary mb-1">Today's weight (kg)</span>
				<NumberSpinner bind:value={kg} min={30} max={250} step={0.1} />
			</label>
			<Button onclick={save}>Save</Button>
		</div>
	</Card>
	<Card>
		<WeightChart data={weights} />
	</Card>
</div>
```

- [ ] **Step 3: Update Progress layout**

In `src/routes/(public)/progress/+layout.svelte`, add tabs/links for `/progress/nutrition` and `/progress/weight` alongside the existing Charts/Records/Sessions. Match the existing tab styling exactly (read the current file first, copy the pattern).

- [ ] **Step 4: Type-check + manual smoke**

Run: `npm run check`
Then `npm run dev` → /progress/weight → enter weight → save → chart renders. Refresh: weight persists.

- [ ] **Step 5: Commit**

```bash
git add src/routes/(public)/progress/weight/+page.svelte src/lib/components/WeightChart.svelte src/routes/(public)/progress/+layout.svelte
git commit -m "feat(nutrition): add weight tracking page"
```

---

## Task 22: Progress → Nutrition route

**Files:**
- Create: `src/routes/(public)/progress/nutrition/+page.svelte`

Daily history view: last N days as a list with totals + protein bar vs target.

- [ ] **Step 1: Implement `src/routes/(public)/progress/nutrition/+page.svelte`**

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import Card from '$lib/ui/Card.svelte';
	import { dailyTotals, latestWeightKg } from '$lib/nutrition/db';
	import { addDays, formatDateLabel, todayString } from '$lib/nutrition/dates';
	import { computeTargets } from '$lib/nutrition/targets';
	import { nutritionProfileStore } from '$lib/stores/nutritionProfile.svelte';
	import type { FoodMacros } from '$lib/types';

	const DAYS = 14;
	let kg = $state<number>(80);
	let rows = $state<{ date: string; totals: FoodMacros }[]>([]);

	const targets = $derived(computeTargets(nutritionProfileStore.snapshot(), kg));

	onMount(async () => {
		await nutritionProfileStore.load();
		const w = await latestWeightKg();
		if (w !== null) kg = w;
		const today = todayString();
		const out: { date: string; totals: FoodMacros }[] = [];
		for (let i = 0; i < DAYS; i++) {
			const d = addDays(today, -i);
			out.push({ date: d, totals: await dailyTotals(d) });
		}
		rows = out;
	});

	function pct(c: number, t: number): number {
		if (t <= 0) return 0;
		return Math.min(100, Math.round((c / t) * 100));
	}
</script>

<PageHeader title="Nutrition history" backHref="/progress" />

<div class="max-w-2xl mx-auto px-4 space-y-3 pb-24">
	{#each rows as row (row.date)}
		<Card>
			<div class="flex items-center justify-between mb-2">
				<div class="font-medium">{formatDateLabel(row.date)}</div>
				<div class="text-sm text-text-secondary">{row.totals.kcal} kcal · {row.totals.protein}g P</div>
			</div>
			<div class="h-2 rounded-full bg-surface-hover overflow-hidden">
				<div class="h-full bg-accent" style="width: {pct(row.totals.protein, targets.protein)}%"></div>
			</div>
		</Card>
	{/each}
</div>
```

- [ ] **Step 2: Type-check + manual smoke**

Run: `npm run check`
Then `npm run dev` → /progress/nutrition → confirm 14 day rows with totals.

- [ ] **Step 3: Commit**

```bash
git add src/routes/(public)/progress/nutrition/+page.svelte
git commit -m "feat(nutrition): add nutrition history page"
```

---

## Task 23: Edit-entry support

**Files:**
- Modify: `src/routes/(public)/log/+page.svelte`

Currently entries can be deleted but not edited. Add a tap-to-edit affordance on each entry (just grams + note).

- [ ] **Step 1: Add edit modal state + handlers**

In Log page, add:

```typescript
let editEntry = $state<FoodEntry | null>(null);

function startEdit(e: FoodEntry) { editEntry = e; }

async function saveEdit({ grams, note, macros }: { grams: number; note?: string; macros: FoodMacros }) {
	if (!editEntry) return;
	await updateEntry(editEntry.id, { grams, macros, note });
	editEntry = null;
	await refresh();
	toastStore.showSuccess('Entry updated');
}
```

Add import:

```typescript
import { updateEntry } from '$lib/nutrition/db';
```

- [ ] **Step 2: Make entry rows clickable + add edit modal**

Replace the existing entry `<li>` row with a clickable button:

```svelte
<li class="flex items-center justify-between py-3">
	<button type="button" class="flex-1 text-left" onclick={() => startEdit(entry)}>
		<div class="text-text-primary font-medium">{entryName(entry)}</div>
		<div class="text-xs text-text-secondary">
			{entry.grams}g · {entry.macros.kcal}kcal · {entry.macros.protein}g P
			{#if entry.note}· {entry.note}{/if}
		</div>
	</button>
	<button
		type="button"
		class="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"
		onclick={() => remove(entry)}
		aria-label="Delete entry"
	>
		<Trash2 class="w-4 h-4" />
	</button>
</li>
```

Add edit modal at end of template:

```svelte
<Modal open={editEntry !== null} title="Edit entry" onclose={() => editEntry = null}>
	{#if editEntry}
		<FoodEntryForm
			name={entryName(editEntry)}
			per100g={editEntry.foodId
				? (nameById.get(editEntry.foodId) ? { kcal: editEntry.macros.kcal * 100 / editEntry.grams, protein: editEntry.macros.protein * 100 / editEntry.grams, carbs: editEntry.macros.carbs * 100 / editEntry.grams, fat: editEntry.macros.fat * 100 / editEntry.grams } : { kcal: 0, protein: 0, carbs: 0, fat: 0 })
				: editEntry.inlineFood?.per100g ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }}
			initialGrams={editEntry.grams}
			initialNote={editEntry.note ?? ''}
			submitLabel="Save"
			onSubmit={saveEdit}
			onCancel={() => editEntry = null}
		/>
	{/if}
</Modal>
```

If `Modal` exports a different open API (e.g. `bind:open`), match the existing pattern: read `Modal.svelte` first.

- [ ] **Step 3: Type-check + manual smoke**

Run: `npm run check`
Then `npm run dev` → /log → tap entry → edit grams → save → totals recompute.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(public)/log/+page.svelte
git commit -m "feat(nutrition): add entry editing"
```

---

## Task 24: End-to-end verification + final cleanup

**Files:** none (verification only)

- [ ] **Step 1: Run full check + tests**

Run:
```bash
npm run check
npm run test:run
npm run test:e2e
```
Expected: all green. If e2e tests reference a 4-tab nav, update selectors.

- [ ] **Step 2: Manual end-to-end checklist**

In `npm run dev`:

1. **Profile setup**: /settings/profile → enter 80kg, 180cm, 30y, male, moderate, maintain → save → confirm computed targets ~2700 kcal, 160g P.
2. **Override**: bump protein override to 200g → save → reload → override persists.
3. **Manual entry**: /log → Add → Manual → name "Test", 100kcal/10P/15C/2F per 100g → 200g → save → entry appears, totals update.
4. **Search**: /log → Add → Search → type "havre" (assumes Livs bundle populated) → pick → 80g → save → entry appears.
5. **Saved-foods reuse**: /log → Add → Search (no query) → previously-added foods appear at top.
6. **Barcode (camera browser)**: /log → Scan → scan a Swedish product → OFF data pre-fills entry → save.
7. **Barcode cache**: re-scan same product offline → instant from saved foods.
8. **Barcode not found**: scan obscure barcode → manual entry pre-filled with barcode.
9. **Weight**: /progress/weight → log weights for two consecutive days → chart renders.
10. **History**: /progress/nutrition → 14-day list shows correct totals + protein bars.
11. **Date navigation**: /log → previous-day chevron → entries from yesterday show.
12. **Edit/delete**: tap entry → edit grams → save → delete → confirm.
13. **Sync**: pair a second device via existing invite flow → log a food on A → wait sync interval → confirm on B.

- [ ] **Step 3: Update e2e baseline (if needed)**

If Playwright snapshots / nav-tab assertions fail because of the new Log tab, update them in the same commit as the navigation change (Task 11) — not here. If found here, fix and commit:

```bash
git add tests/
git commit -m "test: update for Log tab + nutrition routes"
```

- [ ] **Step 4: Final commit (if anything trailing)**

```bash
git status
# only commit if there are stragglers
```

---

## Out of Scope Reminders

These are intentionally **not** in this plan:

- Health App rebrand (name, logo, manifest, marketing copy, full IA rework). Separate spec after this ships.
- Water tracking, recipes, photo logging, micronutrients, supplements, fixed meal buckets.
- Workout-start UI on the Log tab (deferred until rebrand).
- Weight unit toggle (kg/lb) within nutrition — uses kg per default; unit display reuses `preferencesStore` if needed in a follow-up.
- Migration of older clients — Tablinum tolerates added collections; nothing to migrate.

## Notes for the Implementer

- **License gate (Task 13)**: do not commit Livsmedelsverket source data without confirming the license. If the license doesn't permit redistribution, fall back to OFF Swedish subset (filter `countries_tags` for `en:sweden` at build time). The `parseSource` function is the only thing that changes.
- **Existing UI primitives**: read each component you reuse (`NumberSpinner`, `Modal`, `Toggle`, `Select`) before assuming the prop API. Adapt the snippets in this plan to match what's actually exported.
- **Svelte 5 runes**: this codebase uses runes (`$state`, `$derived`, `$effect`, `$props`). Don't introduce stores from `svelte/store`.
- **Tablinum quirks**: collections need to be registered before any read/write. The schema diff is non-destructive; existing data is unaffected.
- **Frequent commits**: every task ends with a commit. Don't batch.
