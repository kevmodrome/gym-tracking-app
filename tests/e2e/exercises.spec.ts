import { test, expect } from './fixtures';

test.describe('Exercise Library', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to exercises page
		await page.goto('/exercises');
		await page.waitForLoadState('networkidle');
		// Wait for exercises to load (they should auto-seed on first load)
		await page.waitForSelector('a[href^="/exercises/"]', { timeout: 10000 }).catch(() => {});
	});

	test('displays the exercise library page', async ({ page }) => {
		// Check page title and header
		await expect(page.locator('h1')).toContainText('Browse Exercises');

		// Check the "Add Exercise" button exists
		await expect(page.getByRole('link', { name: /add exercise/i })).toBeVisible();
	});

	test('loads pre-seeded exercises', async ({ page }) => {
		// Check that exercise cards are displayed
		const exerciseCards = page.locator('a[href^="/exercises/"]').filter({ hasNot: page.locator('text=Add Exercise') });
		await expect(exerciseCards.first()).toBeVisible({ timeout: 10000 });

		const count = await exerciseCards.count();
		expect(count).toBeGreaterThan(0);

		// Verify first exercise has required fields displayed
		const firstCard = exerciseCards.first();
		await expect(firstCard.locator('text=Category:')).toBeVisible();
		await expect(firstCard.locator('text=Primary:')).toBeVisible();
	});

	test('can search exercises by name', async ({ page }) => {
		// Get exercise cards (exclude Add Exercise link)
		const exerciseCards = page.locator('a[href^="/exercises/"]').filter({ has: page.locator('h3') });
		await expect(exerciseCards.first()).toBeVisible();

		// Get initial count
		const initialCount = await exerciseCards.count();

		// Type in search box
		await page.getByPlaceholder('Search exercises...').fill('Bench Press');

		// Wait for filtering
		await page.waitForTimeout(500);

		// Check filtered results
		const filteredCount = await exerciseCards.count();
		expect(filteredCount).toBeLessThanOrEqual(initialCount);

		// Verify the result contains the search term
		const firstExerciseName = await exerciseCards.first().locator('h3').textContent();
		expect(firstExerciseName?.toLowerCase()).toContain('bench press');
	});

	test('can filter exercises by category', async ({ page }) => {
		// Get exercise cards
		const exerciseCards = page.locator('a[href^="/exercises/"]').filter({ has: page.locator('h3') });
		await expect(exerciseCards.first()).toBeVisible();

		// Get initial count
		const initialCount = await exerciseCards.count();

		// Select "Compound" category from dropdown
		await page.getByLabel('Category').selectOption('compound');

		// Wait for filtering
		await page.waitForTimeout(500);

		// Check that results are filtered
		const filteredCount = await exerciseCards.count();
		expect(filteredCount).toBeLessThanOrEqual(initialCount);

		// Verify displayed exercises show compound category
		if (filteredCount > 0) {
			const firstCard = exerciseCards.first();
			await expect(firstCard.getByText('compound', { exact: false })).toBeVisible();
		}
	});

	test('can filter exercises by muscle group', async ({ page }) => {
		// Get exercise cards
		const exerciseCards = page.locator('a[href^="/exercises/"]').filter({ has: page.locator('h3') });
		await expect(exerciseCards.first()).toBeVisible();

		// Select "Chest" muscle group from dropdown
		await page.getByLabel('Muscle Group').selectOption('chest');

		// Wait for filtering
		await page.waitForTimeout(500);

		// Check filtered results
		const filteredCount = await exerciseCards.count();
		expect(filteredCount).toBeGreaterThan(0);

		// Verify displayed exercises show chest as primary muscle
		const firstCard = exerciseCards.first();
		await expect(firstCard.getByText('chest', { exact: false })).toBeVisible();
	});

	test('can combine search and filter', async ({ page }) => {
		// Get exercise cards
		const exerciseCards = page.locator('a[href^="/exercises/"]').filter({ has: page.locator('h3') });
		await expect(exerciseCards.first()).toBeVisible();

		// Search and filter combined
		await page.getByPlaceholder('Search exercises...').fill('Press');
		await page.getByLabel('Category').selectOption('compound');

		// Wait for filtering
		await page.waitForTimeout(300);

		// Check that filter info is displayed
		await expect(page.getByText(/Showing \d+ of \d+ exercises/)).toBeVisible();

		// Check clear filters button appears
		await expect(page.getByText('Clear Filters')).toBeVisible();
	});

	test('can clear filters', async ({ page }) => {
		// Get exercise cards
		const exerciseCards = page.locator('a[href^="/exercises/"]').filter({ has: page.locator('h3') });
		await expect(exerciseCards.first()).toBeVisible();

		// Apply some filters
		await page.getByPlaceholder('Search exercises...').fill('Press');
		await page.getByLabel('Category').selectOption('compound');

		// Wait for filtering
		await page.waitForTimeout(500);

		// Get filtered count
		const filteredCount = await exerciseCards.count();

		// Clear filters
		await page.getByText('Clear Filters').click();

		// Wait for reset
		await page.waitForTimeout(500);

		// Verify filters are cleared
		const resetCount = await exerciseCards.count();
		expect(resetCount).toBeGreaterThanOrEqual(filteredCount);

		// Verify search input is cleared
		await expect(page.getByPlaceholder('Search exercises...')).toHaveValue('');
	});

	test('shows empty state when no exercises match', async ({ page }) => {
		// Get exercise cards to ensure they've loaded first
		const exerciseCards = page.locator('a[href^="/exercises/"]').filter({ has: page.locator('h3') });
		await expect(exerciseCards.first()).toBeVisible();

		// Search for something that doesn't exist
		await page.getByPlaceholder('Search exercises...').fill('xyznonexistent123');

		// Wait for filtering
		await page.waitForTimeout(500);

		// Check empty state message
		await expect(page.getByText('No exercises found')).toBeVisible();
		await expect(page.getByText('Try adjusting your search or filters')).toBeVisible();
	});
});

test.describe('Create Custom Exercise', () => {
	test('can navigate to create exercise page', async ({ page }) => {
		await page.goto('/exercises');
		await page.waitForLoadState('networkidle');

		// Click the Add Exercise button
		await page.getByRole('link', { name: /add exercise/i }).click();

		// Verify we're on the create page
		await expect(page).toHaveURL('/exercises/new');
		await expect(page.getByText('Create Custom Exercise')).toBeVisible();
	});

	test('shows validation errors for required fields', async ({ page }) => {
		await page.goto('/exercises/new');
		await page.waitForLoadState('networkidle');

		// Wait for the modal to appear
		await expect(page.getByText('Create Custom Exercise')).toBeVisible();

		// Check validation message shows for empty name
		await expect(page.getByText('Exercise name is required')).toBeVisible();

		// Verify the Create Exercise button exists
		const createButton = page.getByRole('button', { name: 'Create Exercise' });
		await expect(createButton).toBeVisible();
	});

	test('can create a custom exercise', async ({ page }) => {
		await page.goto('/exercises/new');
		await page.waitForLoadState('networkidle');

		// Wait for the modal to appear
		await expect(page.getByText('Create Custom Exercise')).toBeVisible();

		// Fill in the form
		await page.getByLabel(/Exercise Name/i).fill('My Custom Push-Up');

		// Select category
		await page.getByLabel(/Category/i).selectOption('compound');

		// Select primary muscle
		await page.getByLabel(/Primary Muscle Group/i).selectOption('chest');

		// Add optional equipment
		await page.getByLabel(/Equipment/i).fill('Bodyweight');

		// Click create button
		await page.getByRole('button', { name: 'Create Exercise' }).click();

		// Should navigate back to exercises list
		await expect(page).toHaveURL('/exercises');

		// Search for the new exercise
		await page.getByPlaceholder('Search exercises...').fill('My Custom Push-Up');
		await page.waitForTimeout(500);

		// Verify it appears in the list
		await expect(page.getByRole('heading', { name: 'My Custom Push-Up' })).toBeVisible();

		// Verify it has the Custom badge (use more specific selector)
		const exerciseCard = page.locator('a[href^="/exercises/"]').filter({ hasText: 'My Custom Push-Up' });
		await expect(exerciseCard.locator('span:text("Custom")')).toBeVisible();
	});

	test('can add secondary muscles', async ({ page }) => {
		await page.goto('/exercises/new');
		await page.waitForLoadState('networkidle');

		// Wait for the modal to appear
		await expect(page.getByText('Create Custom Exercise')).toBeVisible();

		// Fill required fields first
		await page.getByLabel(/Exercise Name/i).fill('Test Exercise');
		await page.getByLabel(/Category/i).selectOption('compound');
		await page.getByLabel(/Primary Muscle Group/i).selectOption('chest');

		// Add secondary muscle
		const secondaryInput = page.getByPlaceholder('e.g., triceps (press Enter to add)');
		await secondaryInput.fill('triceps');
		await page.getByRole('button', { name: 'Add' }).click();

		// Verify it was added - look for the chip/badge
		await expect(page.locator('span').filter({ hasText: 'triceps' }).first()).toBeVisible();

		// Add another using Enter key
		await secondaryInput.fill('shoulders');
		await secondaryInput.press('Enter');

		// Verify both are shown
		await expect(page.locator('span').filter({ hasText: 'shoulders' }).first()).toBeVisible();
	});

	test('can cancel exercise creation', async ({ page }) => {
		await page.goto('/exercises/new');
		await page.waitForLoadState('networkidle');

		// Click cancel
		await page.getByRole('button', { name: 'Cancel' }).click();

		// Should navigate back to exercises list
		await expect(page).toHaveURL('/exercises');
	});
});

test.describe('Exercise Details', () => {
	test('can view exercise details', async ({ page }) => {
		await page.goto('/exercises');
		await page.waitForLoadState('networkidle');

		// Get exercise cards (exclude Add Exercise link)
		const exerciseCards = page.locator('a[href^="/exercises/"]').filter({ has: page.locator('h3') });
		await expect(exerciseCards.first()).toBeVisible({ timeout: 10000 });

		// Get the first exercise name
		const exerciseName = await exerciseCards.first().locator('h3').textContent();

		// Click on it
		await exerciseCards.first().click();

		// Verify we're on the details page
		await expect(page).toHaveURL(/\/exercises\/\d+/);

		// Verify the exercise name is displayed
		if (exerciseName) {
			await expect(page.getByRole('heading', { name: exerciseName })).toBeVisible();
		}
	});
});
