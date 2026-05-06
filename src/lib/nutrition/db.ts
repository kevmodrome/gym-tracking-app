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
	const all = await db.collection('foods').get() as Food[];
	return all.find((f) => f.id === id) ?? null;
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

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

export async function dailyTotals(date: string): Promise<FoodMacros> {
	const entries = await listEntriesForDate(date);
	const sum = entries.reduce<FoodMacros>(
		(acc, e) => ({
			kcal: acc.kcal + e.macros.kcal,
			protein: acc.protein + e.macros.protein,
			carbs: acc.carbs + e.macros.carbs,
			fat: acc.fat + e.macros.fat,
		}),
		{ kcal: 0, protein: 0, carbs: 0, fat: 0 },
	);
	// Floating-point sums can yield values like 10.200000000000001; clamp to display precision.
	return {
		kcal: Math.round(sum.kcal),
		protein: round1(sum.protein),
		carbs: round1(sum.carbs),
		fat: round1(sum.fat),
	};
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
	const all = await db.collection('nutritionProfile').get() as NutritionProfile[];
	return all[0] ?? null;
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
