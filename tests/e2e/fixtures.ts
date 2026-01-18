import { test as base, expect } from '@playwright/test';

type PageFixture = {
	navigateToHome: () => Promise<void>;
	navigateToWorkout: () => Promise<void>;
	navigateToExercises: () => Promise<void>;
	navigateToProgress: () => Promise<void>;
	navigateToSettings: () => Promise<void>;
	clearDatabase: () => Promise<void>;
	clearLocalStorage: () => Promise<void>;
};

export const test = base.extend<PageFixture>({
	navigateToHome: async ({ page }, use) => {
		await use(async () => {
			await page.goto('/');
			await page.waitForLoadState('networkidle');
			// Verify page loaded (not 404)
			await expect(page).not.toHaveTitle(/404|Not Found/i);
		});
	},
	navigateToWorkout: async ({ page }, use) => {
		await use(async () => {
			await page.goto('/workout');
			await page.waitForLoadState('networkidle');
			await expect(page).not.toHaveTitle(/404|Not Found/i);
		});
	},
	navigateToExercises: async ({ page }, use) => {
		await use(async () => {
			await page.goto('/exercises');
			await page.waitForLoadState('networkidle');
			await expect(page).not.toHaveTitle(/404|Not Found/i);
		});
	},
	navigateToProgress: async ({ page }, use) => {
		await use(async () => {
			await page.goto('/progress');
			await page.waitForLoadState('networkidle');
			await expect(page).not.toHaveTitle(/404|Not Found/i);
		});
	},
	navigateToSettings: async ({ page }, use) => {
		await use(async () => {
			await page.goto('/settings');
			await page.waitForLoadState('networkidle');
			await expect(page).not.toHaveTitle(/404|Not Found/i);
		});
	},
	clearDatabase: async ({ page }, use) => {
		await use(async () => {
			await page.evaluate(async () => {
				const databases = await indexedDB.databases();
				for (const db of databases) {
					if (db.name) {
						indexedDB.deleteDatabase(db.name);
					}
				}
			});
		});
	},
	clearLocalStorage: async ({ page }, use) => {
		await use(async () => {
			await page.evaluate(() => {
				localStorage.clear();
			});
		});
	}
});

export { expect } from '@playwright/test';
