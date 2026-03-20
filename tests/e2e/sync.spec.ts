import { test, expect } from './fixtures';

test.describe('Sync Settings UI', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
	});

	test('displays sync section with connection status', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Sync' })).toBeVisible();
		await expect(page.getByText('Connection Status')).toBeVisible();
	});

	test('displays sync status', async ({ page }) => {
		await expect(page.getByText('Sync Status')).toBeVisible();
	});

	test('has sync now button', async ({ page }) => {
		await expect(page.getByRole('button', { name: 'Sync Now' })).toBeVisible();
	});

	test('displays about sync information', async ({ page }) => {
		await expect(page.getByText('About Sync')).toBeVisible();
		await expect(page.getByText('Your data is encrypted end-to-end')).toBeVisible();
		await expect(page.getByText('Changes sync automatically via Nostr relays')).toBeVisible();
	});
});
