import { test, expect } from './fixtures';

test.describe('E2E Test Setup', () => {
	test('playwright is configured correctly', async ({ page }) => {
		await page.goto('/');
		expect(page).toBeTruthy();
	});

	test('can navigate to home page', async ({ navigateToHome }) => {
		await navigateToHome();
	});

	test('can navigate to dashboard', async ({ navigateToDashboard }) => {
		await navigateToDashboard();
	});

	test('can navigate to workout', async ({ navigateToWorkout }) => {
		await navigateToWorkout();
	});

	test('can navigate to history', async ({ navigateToHistory }) => {
		await navigateToHistory();
	});

	test('can navigate to progress', async ({ navigateToProgress }) => {
		await navigateToProgress();
	});
});
