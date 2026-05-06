/**
 * Fetches the Livsmedelsverket food database from the official open API and
 * writes a normalized bundle for the app.
 *
 * Source: https://dataportal.livsmedelsverket.se/livsmedel/swagger/index.html
 * License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
 *           — attribution to Livsmedelsverket required.
 *
 * Output schema:
 *   {
 *     generatedAt: string,
 *     attribution: string,
 *     license: string,
 *     foods: [{ id, name, per100g: { kcal, protein, carbs, fat } }],
 *   }
 *
 * If the API can't be reached, exits with the existing bundle untouched (or an
 * empty bundle on first run) and a non-zero status — the app degrades gracefully.
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface NormalizedFood {
	id: string;
	name: string;
	per100g: { kcal: number; protein: number; carbs: number; fat: number };
}

const API = 'https://dataportal.livsmedelsverket.se/livsmedel/api/v1';
const OUT_PATH = join(process.cwd(), 'static/livs-foods.json');
const ATTRIBUTION = 'Source: Livsmedelsverket (Swedish Food Agency), Livsmedelsdatabasen.';
const LICENSE = 'CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/';
const CONCURRENCY = 12;

interface ListItem {
	nummer: number;
	namn: string;
}

interface NutrientItem {
	namn?: string;
	euroFIRkod?: string;
	varde?: number;
	enhet?: string;
}

async function fetchList(): Promise<ListItem[]> {
	// One call with a generous limit pulls every food's metadata.
	const res = await fetch(`${API}/livsmedel?offset=0&limit=5000`);
	if (!res.ok) throw new Error(`List failed: HTTP ${res.status}`);
	const json = await res.json() as { livsmedel: ListItem[]; _meta?: { totalRecords: number } };
	return json.livsmedel;
}

function pick(nutrients: NutrientItem[], match: (n: NutrientItem) => boolean): number {
	const n = nutrients.find(match);
	return n && typeof n.varde === 'number' ? n.varde : 0;
}

function extractMacros(nutrients: NutrientItem[]): NormalizedFood['per100g'] {
	return {
		kcal: pick(nutrients, (n) => n.euroFIRkod === 'ENERC' && n.enhet === 'kcal'),
		protein: pick(nutrients, (n) => n.euroFIRkod === 'PROT'),
		carbs: pick(nutrients, (n) => n.euroFIRkod === 'CHO'),
		fat: pick(nutrients, (n) => n.euroFIRkod === 'FAT'),
	};
}

async function fetchNutrients(nummer: number, attempt = 0): Promise<NutrientItem[]> {
	try {
		const res = await fetch(`${API}/livsmedel/${nummer}/naringsvarden`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json() as NutrientItem[];
	} catch (err) {
		if (attempt < 3) {
			await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
			return fetchNutrients(nummer, attempt + 1);
		}
		throw err;
	}
}

async function pool<T, R>(items: T[], worker: (item: T, i: number) => Promise<R>, size: number): Promise<R[]> {
	const out: R[] = new Array(items.length);
	let cursor = 0;
	const runners = Array.from({ length: size }, async () => {
		while (true) {
			const i = cursor++;
			if (i >= items.length) return;
			out[i] = await worker(items[i], i);
		}
	});
	await Promise.all(runners);
	return out;
}

async function main(): Promise<void> {
	console.log('[build-livs] Fetching food list…');
	let list: ListItem[];
	try {
		list = await fetchList();
	} catch (e) {
		console.error('[build-livs] Failed to fetch list:', (e as Error).message);
		if (!existsSync(OUT_PATH)) {
			writeFileSync(OUT_PATH, JSON.stringify({
				generatedAt: new Date().toISOString(),
				attribution: ATTRIBUTION,
				license: LICENSE,
				foods: [],
			}));
		}
		process.exit(1);
	}

	console.log(`[build-livs] Got ${list.length} foods. Fetching nutrients (concurrency=${CONCURRENCY})…`);

	let done = 0;
	const foods = await pool(list, async (item) => {
		const nutrients = await fetchNutrients(item.nummer);
		done++;
		if (done % 200 === 0) console.log(`  …${done}/${list.length}`);
		return {
			id: `livs-${item.nummer}`,
			name: item.namn,
			per100g: extractMacros(nutrients),
		} satisfies NormalizedFood;
	}, CONCURRENCY);

	const bundle = {
		generatedAt: new Date().toISOString(),
		attribution: ATTRIBUTION,
		license: LICENSE,
		foods,
	};

	writeFileSync(OUT_PATH, JSON.stringify(bundle));
	console.log(`[build-livs] Wrote ${foods.length} foods to ${OUT_PATH}`);
}

main().catch((e) => {
	console.error('[build-livs] Fatal:', e);
	process.exit(1);
});
