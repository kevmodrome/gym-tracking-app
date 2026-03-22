import { test, expect } from './fixtures';

test.describe('Sync Settings UI', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
	});

	test('displays sync section with connection status', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Sync', exact: true })).toBeVisible();
		await expect(page.getByText('Connection Status')).toBeVisible();
	});

	test('displays sync status', async ({ page }) => {
		await expect(page.getByText('Sync Status')).toBeVisible();
	});

	test('has device connection actions', async ({ page }) => {
		await expect(page.getByRole('button', { name: 'Connect Another Device' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Join with Invite Code' })).toBeVisible();
	});

	test('displays about sync information', async ({ page }) => {
		await expect(page.getByText('About Sync')).toBeVisible();
		await expect(page.getByText('Your data is encrypted end-to-end')).toBeVisible();
		await expect(page.getByText('Changes sync automatically via Nostr relays')).toBeVisible();
	});

	test('opens the join invite modal', async ({ page }) => {
		await page.getByRole('button', { name: 'Join with Invite Code' }).click();
		await expect(page.getByRole('heading', { name: 'Join with Invite Code' })).toBeVisible();
		await expect(page.getByLabel('Invite Code or Link')).toBeVisible();
	});
});
