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
