import { test, expect } from './fixtures';

test.describe('Sync Key Generation', () => {
	test.beforeEach(async ({ page, clearLocalStorage }) => {
		// Navigate first, then clear localStorage (can only access localStorage on a real page)
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await clearLocalStorage();
		// Reload to apply cleared state
		await page.reload();
		await page.waitForLoadState('networkidle');
	});

	test('displays sync setup options when not connected', async ({ page }) => {
		// Verify the sync section is visible
		await expect(page.getByRole('heading', { name: 'Data Sync' })).toBeVisible();

		// Should show setup options (not connected state)
		await expect(page.getByText('Enable sync to keep your data synchronized across devices')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Generate New Key' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Enter Existing Key' })).toBeVisible();
	});

	test('can generate a new sync key', async ({ page }) => {
		// Click Generate New Key
		await page.getByRole('button', { name: 'Generate New Key' }).click();

		// Wait for the sync key to appear (connected state)
		await expect(page.locator('h3').filter({ hasText: 'Your Sync Key' })).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('Connected')).toBeVisible();

		// Verify sync key is displayed and has valid UUID format
		const syncKeyElement = page.locator('code').first();
		await expect(syncKeyElement).toBeVisible();
		const syncKey = await syncKeyElement.textContent();
		expect(syncKey).toMatch(/^[a-f0-9-]{36}$/i);

		// Verify Last Synced section appears
		await expect(page.getByText('Last Synced')).toBeVisible();

		// Verify control buttons
		await expect(page.getByRole('button', { name: 'Sync Now' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible();
	});

	test('sync key persists after page reload', async ({ page }) => {
		// Generate a new sync key
		await page.getByRole('button', { name: 'Generate New Key' }).click();
		await expect(page.locator('h3').filter({ hasText: 'Your Sync Key' })).toBeVisible({ timeout: 10000 });

		// Get the sync key
		const syncKeyElement = page.locator('code').first();
		const originalSyncKey = await syncKeyElement.textContent();

		// Reload the page
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Verify sync key is still displayed
		await expect(page.locator('h3').filter({ hasText: 'Your Sync Key' })).toBeVisible();
		const reloadedSyncKey = await page.locator('code').first().textContent();
		expect(reloadedSyncKey).toBe(originalSyncKey);
	});
});

test.describe('Enter Existing Sync Key', () => {
	test.beforeEach(async ({ page, clearLocalStorage }) => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await clearLocalStorage();
		await page.reload();
		await page.waitForLoadState('networkidle');
	});

	test('can open enter key modal', async ({ page }) => {
		await page.getByRole('button', { name: 'Enter Existing Key' }).click();

		// Verify modal opens
		await expect(page.getByRole('heading', { name: 'Enter Sync Key' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Sync Key' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
	});

	test('can cancel enter key modal', async ({ page }) => {
		await page.getByRole('button', { name: 'Enter Existing Key' }).click();
		await expect(page.getByRole('heading', { name: 'Enter Sync Key' })).toBeVisible();

		// Click cancel
		await page.getByRole('button', { name: 'Cancel' }).click();

		// Modal should close
		await expect(page.getByRole('heading', { name: 'Enter Sync Key' })).not.toBeVisible();

		// Should still show setup options
		await expect(page.getByRole('button', { name: 'Generate New Key' })).toBeVisible();
	});

	test('shows error for invalid sync key format', async ({ page }) => {
		await page.getByRole('button', { name: 'Enter Existing Key' }).click();

		// Enter invalid key format
		await page.getByRole('textbox', { name: 'Sync Key' }).fill('not-a-valid-uuid');
		await page.getByRole('button', { name: 'Connect' }).click();

		// Wait for error toast
		await page.waitForTimeout(500);

		// Should still be in modal (not connected)
		await expect(page.getByRole('heading', { name: 'Enter Sync Key' })).toBeVisible();
	});

	test('shows error for non-existent sync key', async ({ page }) => {
		await page.getByRole('button', { name: 'Enter Existing Key' }).click();

		// Enter valid format but non-existent key
		await page.getByRole('textbox', { name: 'Sync Key' }).fill('00000000-0000-0000-0000-000000000000');
		await page.getByRole('button', { name: 'Connect' }).click();

		// Wait for the request to complete
		await page.waitForTimeout(1000);

		// Should still be in modal (not connected)
		await expect(page.getByRole('heading', { name: 'Enter Sync Key' })).toBeVisible();
	});

	test('can connect with valid existing sync key', async ({ page, request }) => {
		// First, generate a sync key via API
		const newKeyResponse = await request.post('/api/sync/new');
		const { syncKey } = await newKeyResponse.json();

		// Now enter this key in the UI
		await page.getByRole('button', { name: 'Enter Existing Key' }).click();
		await page.getByRole('textbox', { name: 'Sync Key' }).fill(syncKey);
		await page.getByRole('button', { name: 'Connect' }).click();

		// Wait for connection
		await expect(page.locator('h3').filter({ hasText: 'Your Sync Key' })).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('Connected')).toBeVisible();

		// Verify the correct key is displayed
		const displayedKey = await page.locator('code').first().textContent();
		expect(displayedKey).toBe(syncKey);
	});
});

test.describe('Sync Controls', () => {
	let syncKey: string;

	test.beforeEach(async ({ page, clearLocalStorage, request }) => {
		// Generate a sync key via API first
		const response = await request.post('/api/sync/new');
		const data = await response.json();
		syncKey = data.syncKey;

		// Navigate, clear localStorage, then connect
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await clearLocalStorage();
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Connect with the sync key
		await page.getByRole('button', { name: 'Enter Existing Key' }).click();
		await page.getByRole('textbox', { name: 'Sync Key' }).fill(syncKey);
		await page.getByRole('button', { name: 'Connect' }).click();
		await expect(page.locator('h3').filter({ hasText: 'Your Sync Key' })).toBeVisible({ timeout: 10000 });
	});

	test('can disconnect from sync', async ({ page }) => {
		// Set up dialog handler to accept confirmation
		page.on('dialog', (dialog) => dialog.accept());

		// Click disconnect
		await page.getByRole('button', { name: 'Disconnect' }).click();

		// Should show setup options again
		await expect(page.getByText('Enable sync to keep your data synchronized across devices')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Generate New Key' })).toBeVisible();
	});

	test('can trigger manual sync', async ({ page }) => {
		// Click Sync Now
		await page.getByRole('button', { name: 'Sync Now' }).click();

		// Button should show syncing state (disabled or loading)
		// Wait for sync to complete
		await page.waitForTimeout(1000);

		// Should still show connected state
		await expect(page.getByText('Connected', { exact: true })).toBeVisible();
	});

	// Only run clipboard test on Chromium (Firefox/WebKit don't support clipboard permissions)
	test('can copy sync key to clipboard', async ({ page, context, browserName }) => {
		test.skip(browserName !== 'chromium', 'Clipboard permissions only work in Chromium');

		// Grant clipboard permissions
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);

		// Click copy button (📋 emoji)
		await page.locator('button').filter({ hasText: '📋' }).click();

		// Should show checkmark briefly
		await expect(page.locator('button').filter({ hasText: '✓' })).toBeVisible();

		// Verify clipboard content
		const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
		expect(clipboardText).toBe(syncKey);
	});
});

test.describe('Data Sync Between Clients', () => {
	test('syncs exercises between clients', async ({ page, request, clearDatabase, clearLocalStorage }) => {
		// Setup: Navigate first then clear state
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await clearLocalStorage();
		await clearDatabase();
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Generate a sync key
		const newKeyResponse = await request.post('/api/sync/new');
		const { syncKey } = await newKeyResponse.json();

		// Client A: Create a custom exercise
		await page.goto('/exercises/new');
		await page.waitForLoadState('networkidle');
		await expect(page.getByText('Create Custom Exercise')).toBeVisible();

		await page.getByLabel(/Exercise Name/i).fill('Sync Test Exercise');
		await page.getByLabel(/Category/i).selectOption('compound');
		await page.getByLabel(/Primary Muscle Group/i).selectOption('chest');
		await page.getByRole('button', { name: 'Create Exercise' }).click();
		await expect(page).toHaveURL('/exercises');

		// Verify exercise was created locally
		await page.getByPlaceholder('Search exercises...').fill('Sync Test Exercise');
		await page.waitForTimeout(500);
		await expect(page.getByRole('heading', { name: 'Sync Test Exercise' })).toBeVisible();

		// Connect to sync and push data
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Enter Existing Key' }).click();
		await page.getByRole('textbox', { name: 'Sync Key' }).fill(syncKey);
		await page.getByRole('button', { name: 'Connect' }).click();
		await expect(page.locator('h3').filter({ hasText: 'Your Sync Key' })).toBeVisible({ timeout: 10000 });

		// Trigger sync
		await page.getByRole('button', { name: 'Sync Now' }).click();
		await page.waitForTimeout(1000);

		// Verify data is on server via API
		const serverResponse = await request.get(`/api/sync/${syncKey}`);
		const serverData = await serverResponse.json();
		expect(serverData.success).toBe(true);

		const syncedExercise = serverData.data.exercises.find(
			(e: { name: string }) => e.name === 'Sync Test Exercise'
		);
		expect(syncedExercise).toBeDefined();
		expect(syncedExercise.category).toBe('compound');
		expect(syncedExercise.primary_muscle).toBe('chest');
	});

	test('syncs workouts between clients', async ({ page, request, clearDatabase, clearLocalStorage }) => {
		// Setup: Navigate first then clear state
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await clearLocalStorage();
		await clearDatabase();
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Generate a sync key
		const newKeyResponse = await request.post('/api/sync/new');
		const { syncKey } = await newKeyResponse.json();

		// Client A: Create a workout
		await page.goto('/workout/new');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();

		await page.getByLabel(/Workout Name/i).fill('Sync Test Workout');
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page).toHaveURL('/workout');

		// Verify workout was created
		await expect(page.getByText('Sync Test Workout')).toBeVisible();

		// Connect to sync
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Enter Existing Key' }).click();
		await page.getByRole('textbox', { name: 'Sync Key' }).fill(syncKey);
		await page.getByRole('button', { name: 'Connect' }).click();
		await expect(page.locator('h3').filter({ hasText: 'Your Sync Key' })).toBeVisible({ timeout: 10000 });

		// Trigger sync
		await page.getByRole('button', { name: 'Sync Now' }).click();
		await page.waitForTimeout(1000);

		// Verify data is on server
		const serverResponse = await request.get(`/api/sync/${syncKey}`);
		const serverData = await serverResponse.json();
		expect(serverData.success).toBe(true);

		const syncedWorkout = serverData.data.workouts.find(
			(w: { name: string }) => w.name === 'Sync Test Workout'
		);
		expect(syncedWorkout).toBeDefined();
	});

	test('pulls data from server when connecting with existing key', async ({
		page,
		request,
		clearDatabase,
		clearLocalStorage
	}) => {
		// Setup: Navigate first then clear state
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await clearLocalStorage();
		await clearDatabase();
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Generate a sync key and add data directly to server
		const newKeyResponse = await request.post('/api/sync/new');
		const { syncKey } = await newKeyResponse.json();

		// Push data to server via API (simulating another client)
		const serverExercise = {
			id: 'server-exercise-1',
			name: 'Server Created Exercise',
			category: 'isolation',
			primary_muscle: 'arms',
			secondary_muscles: [],
			equipment: 'Dumbbells',
			is_custom: 1,
			updated_at: Date.now()
		};

		await request.post(`/api/sync/${syncKey}`, {
			data: {
				exercises: [serverExercise],
				workouts: [],
				sessions: [],
				personal_records: [],
				lastSync: 0
			}
		});

		// Client B: Connect with the sync key (should pull server data)
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Enter Existing Key' }).click();
		await page.getByRole('textbox', { name: 'Sync Key' }).fill(syncKey);
		await page.getByRole('button', { name: 'Connect' }).click();
		await expect(page.locator('h3').filter({ hasText: 'Your Sync Key' })).toBeVisible({ timeout: 10000 });

		// Wait for sync to complete
		await page.waitForTimeout(1000);

		// Navigate to exercises and verify the server data is now local
		await page.goto('/exercises');
		await page.waitForLoadState('networkidle');

		// Wait for exercises to load
		await page.waitForTimeout(1000);

		// Search for the server-created exercise
		await page.getByPlaceholder('Search exercises...').fill('Server Created Exercise');
		await page.waitForTimeout(1000);

		// Should see the exercise that was pushed to the server
		await expect(page.getByRole('heading', { name: 'Server Created Exercise' })).toBeVisible({ timeout: 10000 });
	});
});

test.describe('Sync API Endpoints', () => {
	test('POST /api/sync/new creates a new sync key', async ({ request }) => {
		const response = await request.post('/api/sync/new');
		expect(response.ok()).toBe(true);

		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.syncKey).toMatch(/^[a-f0-9-]{36}$/i);
	});

	test('GET /api/sync/:key returns 404 for non-existent key', async ({ request }) => {
		const response = await request.get('/api/sync/00000000-0000-0000-0000-000000000000');
		expect(response.status()).toBe(404);

		const data = await response.json();
		expect(data.success).toBe(false);
		expect(data.error).toBe('Sync key not found');
	});

	test('GET /api/sync/:key returns data for existing key', async ({ request }) => {
		// Create a key first
		const createResponse = await request.post('/api/sync/new');
		const { syncKey } = await createResponse.json();

		// Get data
		const response = await request.get(`/api/sync/${syncKey}`);
		expect(response.ok()).toBe(true);

		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data).toBeDefined();
		expect(data.data.exercises).toBeInstanceOf(Array);
		expect(data.data.workouts).toBeInstanceOf(Array);
		expect(data.data.sessions).toBeInstanceOf(Array);
		expect(data.data.personal_records).toBeInstanceOf(Array);
	});

	test('POST /api/sync/:key merges and returns data', async ({ request }) => {
		// Create a key
		const createResponse = await request.post('/api/sync/new');
		const { syncKey } = await createResponse.json();

		// Post data
		const payload = {
			exercises: [
				{
					id: 'test-ex-1',
					name: 'API Test Exercise',
					category: 'compound',
					primary_muscle: 'chest',
					secondary_muscles: [],
					equipment: '',
					is_custom: 1,
					updated_at: Date.now()
				}
			],
			workouts: [],
			sessions: [],
			personal_records: [],
			lastSync: 0
		};

		const response = await request.post(`/api/sync/${syncKey}`, { data: payload });
		expect(response.ok()).toBe(true);

		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.exercises).toHaveLength(1);
		expect(data.data.exercises[0].name).toBe('API Test Exercise');
	});

	test('sync uses last-write-wins for conflicts', async ({ request }) => {
		// Create a key
		const createResponse = await request.post('/api/sync/new');
		const { syncKey } = await createResponse.json();

		const exerciseId = 'conflict-test-ex-1';
		const oldTimestamp = Date.now() - 10000;
		const newTimestamp = Date.now();

		// First sync with "old" data
		await request.post(`/api/sync/${syncKey}`, {
			data: {
				exercises: [
					{
						id: exerciseId,
						name: 'Old Name',
						category: 'compound',
						primary_muscle: 'chest',
						secondary_muscles: [],
						equipment: '',
						is_custom: 1,
						updated_at: oldTimestamp
					}
				],
				workouts: [],
				sessions: [],
				personal_records: [],
				lastSync: 0
			}
		});

		// Second sync with "newer" data
		const response = await request.post(`/api/sync/${syncKey}`, {
			data: {
				exercises: [
					{
						id: exerciseId,
						name: 'New Name',
						category: 'isolation',
						primary_muscle: 'arms',
						secondary_muscles: [],
						equipment: 'Dumbbells',
						is_custom: 1,
						updated_at: newTimestamp
					}
				],
				workouts: [],
				sessions: [],
				personal_records: [],
				lastSync: 0
			}
		});

		const data = await response.json();

		// Newer data should win
		const exercise = data.data.exercises.find((e: { id: string }) => e.id === exerciseId);
		expect(exercise.name).toBe('New Name');
		expect(exercise.category).toBe('isolation');
	});

	test('older data does not overwrite newer data', async ({ request }) => {
		// Create a key
		const createResponse = await request.post('/api/sync/new');
		const { syncKey } = await createResponse.json();

		const exerciseId = 'conflict-test-ex-2';
		const oldTimestamp = Date.now() - 10000;
		const newTimestamp = Date.now();

		// First sync with "newer" data
		await request.post(`/api/sync/${syncKey}`, {
			data: {
				exercises: [
					{
						id: exerciseId,
						name: 'New Name Should Win',
						category: 'isolation',
						primary_muscle: 'arms',
						secondary_muscles: [],
						equipment: '',
						is_custom: 1,
						updated_at: newTimestamp
					}
				],
				workouts: [],
				sessions: [],
				personal_records: [],
				lastSync: 0
			}
		});

		// Second sync with "older" data (should NOT overwrite)
		const response = await request.post(`/api/sync/${syncKey}`, {
			data: {
				exercises: [
					{
						id: exerciseId,
						name: 'Old Name Should Lose',
						category: 'compound',
						primary_muscle: 'chest',
						secondary_muscles: [],
						equipment: '',
						is_custom: 1,
						updated_at: oldTimestamp
					}
				],
				workouts: [],
				sessions: [],
				personal_records: [],
				lastSync: 0
			}
		});

		const data = await response.json();

		// Newer data should still be there (older data should not overwrite)
		const exercise = data.data.exercises.find((e: { id: string }) => e.id === exerciseId);
		expect(exercise.name).toBe('New Name Should Win');
		expect(exercise.category).toBe('isolation');
	});
});
