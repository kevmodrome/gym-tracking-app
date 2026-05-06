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
