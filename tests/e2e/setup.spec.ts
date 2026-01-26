import { test, expect } from './fixtures';

test.describe('E2E Test Setup', () => {
	test('playwright is configured correctly', async ({ page }) => {
		await page.goto('/');
		expect(page).toBeTruthy();
		// Verify we got a real page, not an error
		await expect(page).not.toHaveTitle(/404|Not Found/i);
	});

	test('can navigate to home page', async ({ navigateToHome, page }) => {
		await navigateToHome();
		// Verify home page content is visible
		await expect(page.locator('body')).toBeVisible();
	});

	test('can navigate to new session', async ({ navigateToNewSession, page }) => {
		await navigateToNewSession();
		// Verify session page loaded (should redirect to session/[id])
		await expect(page.locator('body')).toBeVisible();
	});

	test('can navigate to exercises', async ({ navigateToExercises, page }) => {
		await navigateToExercises();
		// Verify exercises page loaded
		await expect(page.locator('body')).toBeVisible();
	});

	test('can navigate to progress', async ({ navigateToProgress, page }) => {
		await navigateToProgress();
		// Verify progress page loaded
		await expect(page.locator('body')).toBeVisible();
	});

	test('can navigate to settings', async ({ navigateToSettings, page }) => {
		await navigateToSettings();
		// Verify settings page loaded
		await expect(page.locator('body')).toBeVisible();
	});
});
