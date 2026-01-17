import { test as base } from '@playwright/test';

type PageFixture = {
	navigateToHome: () => Promise<void>;
	navigateToDashboard: () => Promise<void>;
	navigateToWorkout: () => Promise<void>;
	navigateToHistory: () => Promise<void>;
	navigateToProgress: () => Promise<void>;
};

export const test = base.extend<PageFixture>({
	navigateToHome: async ({ page }, use) => {
		await use(async () => {
			await page.goto('/');
			await page.waitForLoadState('networkidle');
		});
	},
	navigateToDashboard: async ({ page }, use) => {
		await use(async () => {
			await page.goto('/dashboard');
			await page.waitForLoadState('networkidle');
		});
	},
	navigateToWorkout: async ({ page }, use) => {
		await use(async () => {
			await page.goto('/workout');
			await page.waitForLoadState('networkidle');
		});
	},
	navigateToHistory: async ({ page }, use) => {
		await use(async () => {
			await page.goto('/history');
			await page.waitForLoadState('networkidle');
		});
	},
	navigateToProgress: async ({ page }, use) => {
		await use(async () => {
			await page.goto('/progress');
			await page.waitForLoadState('networkidle');
		});
	},
});

export { expect } from '@playwright/test';
