# Livsmedelsverket source

The app's bundled food database (`static/livs-foods.json`) is generated from
the Livsmedelsverket open API.

- **Source:** [Livsmedelsdatabasen](https://dataportal.livsmedelsverket.se/livsmedel/swagger/index.html) — Livsmedelsverket (Swedish Food Agency)
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — attribution to Livsmedelsverket required when redistributing.
- **Records:** ~2,575 foods, each with energy (kcal), protein, carbs (available), fat per 100g.

## Regenerate the bundle

```bash
npm run build:livs
```

The script (`scripts/build-livs.ts`) fetches the full food list and per-food
nutrient values from the API, normalizes to `{ id, name, per100g }`, and writes
`static/livs-foods.json` along with attribution metadata.

It runs concurrently (12 parallel requests), takes ~30–60s, and retries
failed requests up to 3 times with backoff. If the API can't be reached, the
existing bundle is left untouched (or an empty bundle is written on first run)
and the build exits non-zero.

## Notes

- The CSV-based legacy flow has been removed. There is nothing to download
  manually — the API is the source of truth.
- This directory is otherwise empty; it's kept around so the build script can
  be extended to write/cache intermediate artifacts here in the future.
