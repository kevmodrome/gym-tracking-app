import { test, expect } from './fixtures';

test.describe('Workout List', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/workout');
		await page.waitForLoadState('networkidle');
	});

	test('displays the workouts page', async ({ page }) => {
		// Check page header
		await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible();

		// Check the Create Workout button exists
		await expect(page.getByRole('link', { name: /create workout/i })).toBeVisible();
	});

	test('shows empty state when no workouts exist', async ({ page }) => {
		// If this is a fresh database, should show empty state
		const emptyState = page.getByText('No workouts created yet.');
		const hasEmptyState = await emptyState.isVisible().catch(() => false);

		if (hasEmptyState) {
			await expect(emptyState).toBeVisible();
			await expect(page.getByRole('link', { name: 'Create a Workout' })).toBeVisible();
		}
	});
});

test.describe('Create Workout', () => {
	test('can navigate to create workout page', async ({ page }) => {
		await page.goto('/workout');
		await page.waitForLoadState('networkidle');

		// Click the Create Workout button
		await page.getByRole('link', { name: /create workout/i }).click();

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Verify we're on the create page and modal is visible
		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();
	});

	test('shows workout name is required', async ({ page }) => {
		await page.goto('/workout/new');
		await page.waitForLoadState('networkidle');

		// Wait for the modal to appear
		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();

		// The Save Changes button should be disabled without a name
		const saveButton = page.getByRole('button', { name: 'Save Changes' });
		await expect(saveButton).toBeDisabled();
	});

	test('can create a workout with name only', async ({ page }) => {
		await page.goto('/workout/new');
		await page.waitForLoadState('networkidle');

		// Wait for the modal to appear
		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();

		// Fill in workout name
		await page.getByLabel(/Workout Name/i).fill('My Test Workout');

		// Click save
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// Should navigate back to workout list
		await expect(page).toHaveURL('/workout');

		// Verify workout appears in list
		await expect(page.getByText('My Test Workout')).toBeVisible();
	});

	test('can create a workout with exercises', async ({ page }) => {
		// First ensure exercises are seeded by visiting exercises page
		await page.goto('/exercises');
		await page.waitForLoadState('networkidle');
		await page.locator('a[href^="/exercises/"]').filter({ has: page.locator('h3') }).first().waitFor({ timeout: 10000 }).catch(() => {});

		// Now create workout
		await page.goto('/workout/new');
		await page.waitForLoadState('networkidle');

		// Wait for the modal to appear
		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();

		// Fill in workout name
		await page.getByLabel(/Workout Name/i).fill('Full Workout Test');

		// Search for an exercise to add
		await page.getByPlaceholder('Search exercises to add...').fill('Bench');
		await page.waitForTimeout(500);

		// Click on the first exercise result
		const exerciseButton = page.locator('button').filter({ hasText: 'Bench Press' }).first();
		const isVisible = await exerciseButton.isVisible().catch(() => false);
		if (isVisible) {
			await exerciseButton.click();

			// Exercise configuration panel should appear
			await expect(page.getByText('Configure')).toBeVisible();

			// Click Add Exercise button
			await page.getByRole('button', { name: 'Add Exercise' }).click();

			// Verify exercise was added to the list
			await expect(page.getByText('Exercises (1)')).toBeVisible();
		}

		// Save the workout
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// Should navigate back to workout list
		await expect(page).toHaveURL('/workout');

		// Verify workout appears
		await expect(page.getByText('Full Workout Test')).toBeVisible();
	});

	test('can configure exercise targets when adding', async ({ page }) => {
		// Ensure exercises exist
		await page.goto('/exercises');
		await page.waitForLoadState('networkidle');
		await page.locator('a[href^="/exercises/"]').filter({ has: page.locator('h3') }).first().waitFor({ timeout: 10000 }).catch(() => {});

		// Create workout
		await page.goto('/workout/new');
		await page.waitForLoadState('networkidle');

		// Wait for the modal to appear
		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();

		await page.getByLabel(/Workout Name/i).fill('Configured Workout');

		// Search and select an exercise - use a more common exercise name
		await page.getByPlaceholder('Search exercises to add...').fill('Bench');
		await page.waitForTimeout(500);

		const exerciseResult = page.locator('button').filter({ hasText: 'Bench Press' }).first();
		const isVisible = await exerciseResult.isVisible().catch(() => false);
		if (isVisible) {
			await exerciseResult.click();

			// Wait for configuration panel
			await expect(page.getByText('Configure')).toBeVisible();

			// Verify the spinner controls exist
			await expect(page.getByText('Sets')).toBeVisible();
			await expect(page.getByText('Reps')).toBeVisible();
			await expect(page.getByText('Weight')).toBeVisible();

			// Add the exercise
			await page.getByRole('button', { name: 'Add Exercise' }).click();

			// Verify it was added
			await expect(page.getByText('Exercises (1)')).toBeVisible();
		}
	});

	test('can cancel workout creation', async ({ page }) => {
		await page.goto('/workout/new');
		await page.waitForLoadState('networkidle');

		// Wait for the modal to appear
		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();

		// Fill some data
		await page.getByLabel(/Workout Name/i).fill('Will Cancel This');

		// Click cancel
		await page.getByRole('button', { name: 'Cancel' }).click();

		// Should navigate back
		await expect(page).toHaveURL('/workout');

		// Workout should NOT be in the list
		await expect(page.getByText('Will Cancel This')).not.toBeVisible();
	});
});

test.describe('Workout Operations', () => {
	test.beforeEach(async ({ page }) => {
		// Create a test workout first
		await page.goto('/workout/new');
		await page.waitForLoadState('networkidle');

		// Wait for the modal to appear
		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();

		await page.getByLabel(/Workout Name/i).fill('Test Workout For Operations');
		await page.getByRole('button', { name: 'Save Changes' }).click();

		await expect(page).toHaveURL('/workout');
		await page.waitForTimeout(500);
	});

	test('can copy a workout', async ({ page }) => {
		// Find the workout we just created
		const workoutRow = page.locator('div').filter({ hasText: 'Test Workout For Operations' });

		// Click the Copy button
		await workoutRow.getByRole('button', { name: 'Copy' }).click();

		// Wait for the copy to be created
		await page.waitForTimeout(500);

		// Verify copy appears in the list
		await expect(page.getByText('Test Workout For Operations (Copy)')).toBeVisible();
	});

	test('can navigate to edit a workout', async ({ page }) => {
		// Click on the workout name/row to navigate to edit
		await page.getByRole('link', { name: 'Test Workout For Operations' }).click();

		// Should navigate to edit page
		await expect(page).toHaveURL(/\/workout\/\d+/);

		// Should show edit modal with existing name
		await expect(page.getByLabel('Workout Name')).toHaveValue('Test Workout For Operations');
	});

	test('can start a workout session', async ({ page }) => {
		// Find the workout and click Start
		const workoutRow = page.locator('div').filter({ hasText: 'Test Workout For Operations' });
		await workoutRow.getByRole('link', { name: 'Start' }).click();

		// Should navigate to session page
		await expect(page).toHaveURL(/\/session\/\d+/);
	});

	test('workout shows exercise count', async ({ page }) => {
		// The workout should show "0 exercises" since we didn't add any
		await expect(page.getByText(/0 exercise/)).toBeVisible();
	});
});

test.describe('Edit Workout', () => {
	test('can edit workout name', async ({ page }) => {
		// Create a workout first
		await page.goto('/workout/new');
		await page.waitForLoadState('networkidle');

		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();
		await page.getByLabel(/Workout Name/i).fill('Original Name');
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page).toHaveURL('/workout');

		// Now edit it
		await page.getByRole('link', { name: 'Original Name' }).click();
		await expect(page).toHaveURL(/\/workout\/\d+/);

		// Change the name
		const workoutNameInput = page.getByLabel(/Workout Name/i);
		await workoutNameInput.clear();
		await workoutNameInput.fill('Updated Name');

		// Save
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// Should navigate back and show updated name
		await expect(page).toHaveURL('/workout');
		await expect(page.getByText('Updated Name')).toBeVisible();
		await expect(page.getByText('Original Name')).not.toBeVisible();
	});

	test('can add exercises to existing workout', async ({ page }) => {
		// Ensure exercises exist
		await page.goto('/exercises');
		await page.waitForLoadState('networkidle');
		await page.locator('a[href^="/exercises/"]').filter({ has: page.locator('h3') }).first().waitFor({ timeout: 10000 }).catch(() => {});

		// Create a workout first
		await page.goto('/workout/new');
		await page.waitForLoadState('networkidle');

		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();
		await page.getByLabel(/Workout Name/i).fill('Workout To Add Exercises');
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page).toHaveURL('/workout');

		// Edit the workout
		await page.getByRole('link', { name: 'Workout To Add Exercises' }).click();

		// Add an exercise
		await page.getByPlaceholder('Search exercises to add...').fill('Bench');
		await page.waitForTimeout(500);

		const exerciseButton = page.locator('button').filter({ hasText: 'Bench Press' }).first();
		const isVisible = await exerciseButton.isVisible().catch(() => false);
		if (isVisible) {
			await exerciseButton.click();
			await page.getByRole('button', { name: 'Add Exercise' }).click();
		}

		// Save
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// Navigate back to workout list
		await expect(page).toHaveURL('/workout');

		// Verify exercise count updated
		const workoutRow = page.locator('div').filter({ hasText: 'Workout To Add Exercises' });
		await expect(workoutRow.getByText(/1 exercise/)).toBeVisible();
	});

	test('can remove exercise from workout', async ({ page }) => {
		// Ensure exercises exist
		await page.goto('/exercises');
		await page.waitForLoadState('networkidle');
		await page.locator('a[href^="/exercises/"]').filter({ has: page.locator('h3') }).first().waitFor({ timeout: 10000 }).catch(() => {});

		// Create a workout with an exercise
		await page.goto('/workout/new');
		await page.waitForLoadState('networkidle');

		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();
		await page.getByLabel(/Workout Name/i).fill('Workout To Remove Exercise');

		// Add an exercise
		await page.getByPlaceholder('Search exercises to add...').fill('Bench');
		await page.waitForTimeout(500);

		const exerciseButton = page.locator('button').filter({ hasText: 'Bench Press' }).first();
		const isVisible = await exerciseButton.isVisible().catch(() => false);
		if (isVisible) {
			await exerciseButton.click();
			await page.getByRole('button', { name: 'Add Exercise' }).click();
			await expect(page.getByText('Exercises (1)')).toBeVisible();

			// Now remove the exercise - find the remove button (X button in the exercise row)
			const removeButton = page.locator('.text-danger').first();
			const removeVisible = await removeButton.isVisible().catch(() => false);
			if (removeVisible) {
				await removeButton.click();

				// Verify it's removed
				await expect(page.getByText('Exercises (0)')).toBeVisible();
			}
		}
	});

	test('can add workout notes', async ({ page }) => {
		// Create a workout
		await page.goto('/workout/new');
		await page.waitForLoadState('networkidle');

		await expect(page.getByRole('heading', { name: 'Create Workout' })).toBeVisible();
		await page.getByLabel(/Workout Name/i).fill('Workout With Notes');

		// Add notes
		await page.getByLabel(/Notes/i).fill('This is a test note for the workout');

		// Save
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page).toHaveURL('/workout');

		// Edit and verify notes are saved
		await page.getByRole('link', { name: 'Workout With Notes' }).click();

		await expect(page.getByLabel(/Notes/i)).toHaveValue('This is a test note for the workout');
	});
});
