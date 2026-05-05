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
