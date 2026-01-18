import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// iOS requires these specific sizes for apple-touch-icon
const ICON_SIZES = [60, 76, 120, 152, 180, 192, 512];

const svgPath = join(projectRoot, 'static', 'icon-512x512.svg');
const outputDir = join(projectRoot, 'static');

async function generateIcons() {
	const svgBuffer = readFileSync(svgPath);

	for (const size of ICON_SIZES) {
		const outputPath = join(outputDir, `icon-${size}x${size}.png`);

		await sharp(svgBuffer)
			.resize(size, size)
			.png()
			.toFile(outputPath);

		console.log(`Generated: icon-${size}x${size}.png`);
	}

	console.log('All PNG icons generated successfully!');
}

generateIcons().catch((err) => {
	console.error('Error generating icons:', err);
	process.exit(1);
});
