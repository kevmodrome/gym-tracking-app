/**
 * Reads upstream Livsmedelsverket data and writes a normalized JSON for the app.
 * Output schema: { generatedAt, foods: [{ id, name, per100g: { kcal, protein, carbs, fat } }] }
 *
 * If no source file is present, writes an empty bundle (the app degrades gracefully).
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
	const csvPath = join(SOURCE_DIR, 'livsmedelsdatabasen.csv');
	if (!existsSync(csvPath)) {
		console.warn(`[build-livs] Source not found at ${csvPath}; writing empty bundle.`);
		return [];
	}
	const raw = readFileSync(csvPath, 'utf8');
	const lines = raw.split(/\r?\n/).filter(Boolean);
	const header = lines.shift();
	if (!header) return [];

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
