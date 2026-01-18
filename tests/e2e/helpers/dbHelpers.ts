import type { Page } from '@playwright/test';

const DB_NAME = 'gym-recording-app-db';

/**
 * Clears all IndexedDB databases in the browser context
 */
export async function clearIndexedDB(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const databases = await indexedDB.databases();
		for (const db of databases) {
			if (db.name) {
				indexedDB.deleteDatabase(db.name);
			}
		}
	});
}

/**
 * Clears the gym app database specifically
 */
export async function clearGymDatabase(page: Page): Promise<void> {
	await page.evaluate((dbName) => {
		return new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase(dbName);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
			request.onblocked = () => resolve(); // Database might be in use
		});
	}, DB_NAME);
}

/**
 * Gets the count of exercises in the database
 */
export async function getExerciseCount(page: Page): Promise<number> {
	return await page.evaluate((dbName) => {
		return new Promise<number>((resolve, reject) => {
			const request = indexedDB.open(dbName);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains('exercises')) {
					db.close();
					resolve(0);
					return;
				}
				const tx = db.transaction('exercises', 'readonly');
				const store = tx.objectStore('exercises');
				const countRequest = store.count();
				countRequest.onsuccess = () => {
					db.close();
					resolve(countRequest.result);
				};
				countRequest.onerror = () => {
					db.close();
					reject(countRequest.error);
				};
			};
		});
	}, DB_NAME);
}

/**
 * Clears all localStorage keys used by the gym app
 */
export async function clearGymLocalStorage(page: Page): Promise<void> {
	await page.evaluate(() => {
		const keysToRemove = Object.keys(localStorage).filter(
			(key) =>
				key.startsWith('gym-app-') ||
				key.startsWith('gym-recording-') ||
				key.startsWith('workout-') ||
				key.startsWith('session-')
		);
		keysToRemove.forEach((key) => localStorage.removeItem(key));
	});
}

/**
 * Clears all app data (database and localStorage)
 */
export async function clearAllAppData(page: Page): Promise<void> {
	await clearGymDatabase(page);
	await clearGymLocalStorage(page);
}
