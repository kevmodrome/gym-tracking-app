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
	if (!cache) return [];
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
