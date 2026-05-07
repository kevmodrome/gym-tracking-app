import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, './src/lib'),
			'$app/environment': path.resolve(__dirname, './tests/mocks/app-environment.ts'),
			'$app/navigation': path.resolve(__dirname, './tests/mocks/app-navigation.ts')
		}
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/lib/__tests__/setup.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
