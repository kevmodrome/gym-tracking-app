# Livsmedelsverket source

This directory holds the upstream Livsmedelsverket food dataset. The dataset is **not committed** to the repo — it must be downloaded manually after verifying its license permits redistribution.

## Setup

1. Download the open dataset from livsmedelsverket.se (CSV format).
2. Verify the license permits use in this app's distribution.
3. Save it as `livsmedelsdatabasen.csv` in this directory.
4. Run `npm run build:livs` to regenerate `static/livs-foods.json`.

The CSV is expected to be `;`-delimited with columns including: Number, Namn, Energi (kcal/100g), Protein (g/100g), Kolhydrater (g/100g), Fett (g/100g). The build script does case-insensitive partial matching, so column header variations are tolerated.

## License

License of the upstream dataset must be verified before committing it. If it cannot be redistributed, the app falls back to Open Food Facts for searches (planned).
