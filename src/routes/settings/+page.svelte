<script lang="ts">
	import { onMount } from 'svelte';
	import type { AppSettings, UserProfile, NotificationPreferences, AppPreferences } from '$lib/types';
	import ImportBackupModal from '$lib/components/ImportBackupModal.svelte';
	import SyncIndicator from '$lib/components/SyncIndicator.svelte';
	import { exportBackupData } from '$lib/backupUtils';
	import { syncManager } from '$lib/syncUtils';
	import { formatSyncMessage } from '$lib/syncUtils';
	import { Button, TextInput, Select, Toggle, Card, Modal, InfoBox, ConfirmDialog } from '$lib/ui';

	let settings = $state<AppSettings>({
		defaultRestDuration: 90,
		soundEnabled: true,
		vibrationEnabled: true
	});

	let appPreferences = $state<AppPreferences>({
		theme: 'system',
		weightUnit: 'kg',
		distanceUnit: 'km',
		decimalPlaces: 1
	});

	let userProfile = $state<UserProfile>({
		id: 'user-1',
		name: 'Gym User',
		email: 'user@example.com',
		createdAt: new Date().toISOString(),
		status: 'active'
	});

	let notificationPreferences = $state<NotificationPreferences>({
		workoutReminders: true,
		prAchievements: true,
		progressUpdates: false,
		emailNotifications: false
	});

	let showSavedMessage = $state(false);
	let showDeleteConfirm = $state(false);
	let showPasswordChange = $state(false);
	let showImportModal = $state(false);
	let showExportProgress = $state(false);
	let exportProgress = $state({ current: 0, total: 0, stage: '' });
	let exportResult = $state<{ success: boolean; message: string } | null>(null);
	let exportFormat = $state<'json'>('json');
	let newPassword = $state('');
	let confirmNewPassword = $state('');
	let messageTimeout: number | null = null;
	let isSyncing = $state(false);
	let syncResult = $state<{ success: boolean; message: string } | null>(null);

	onMount(() => {
		loadSettings();
		loadUserProfile();
		loadNotificationPreferences();
		loadAppPreferences();
	});

	function loadSettings() {
		const saved = localStorage.getItem('gym-app-settings');
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				settings = { ...settings, ...parsed };
			} catch (e) {
				console.error('Failed to parse settings:', e);
			}
		}
	}

	function loadUserProfile() {
		const saved = localStorage.getItem('gym-app-user-profile');
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				userProfile = { ...userProfile, ...parsed };
			} catch (e) {
				console.error('Failed to parse user profile:', e);
			}
		}
	}

	function loadNotificationPreferences() {
		const saved = localStorage.getItem('gym-app-notification-prefs');
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				notificationPreferences = { ...notificationPreferences, ...parsed };
			} catch (e) {
				console.error('Failed to parse notification preferences:', e);
			}
		}
	}

	function loadAppPreferences() {
		const saved = localStorage.getItem('gym-app-preferences');
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				appPreferences = { ...appPreferences, ...parsed };
			} catch (e) {
				console.error('Failed to parse app preferences:', e);
			}
		}
	}

	function saveSettings() {
		localStorage.setItem('gym-app-settings', JSON.stringify(settings));
		localStorage.setItem('gym-app-user-profile', JSON.stringify(userProfile));
		localStorage.setItem('gym-app-notification-prefs', JSON.stringify(notificationPreferences));
		localStorage.setItem('gym-app-preferences', JSON.stringify(appPreferences));

		showSavedMessage = true;
		if (messageTimeout) {
			clearTimeout(messageTimeout);
		}
		messageTimeout = window.setTimeout(() => {
			showSavedMessage = false;
		}, 3000);
	}

	function saveAppPreferences() {
		localStorage.setItem('gym-app-preferences', JSON.stringify(appPreferences));
		showSavedMessage = true;
		if (messageTimeout) {
			clearTimeout(messageTimeout);
		}
		messageTimeout = window.setTimeout(() => {
			showSavedMessage = false;
		}, 3000);
	}

	function saveProfile() {
		localStorage.setItem('gym-app-user-profile', JSON.stringify(userProfile));
		showSavedMessage = true;
		if (messageTimeout) {
			clearTimeout(messageTimeout);
		}
		messageTimeout = window.setTimeout(() => {
			showSavedMessage = false;
		}, 3000);
	}

	function showPasswordChangeModal() {
		showPasswordChange = true;
	}

	function hidePasswordChangeModal() {
		showPasswordChange = false;
		newPassword = '';
		confirmNewPassword = '';
	}

	function handlePasswordChange() {
		if (newPassword !== confirmNewPassword) {
			alert('Passwords do not match!');
			return;
		}
		if (newPassword.length < 8) {
			alert('Password must be at least 8 characters long!');
			return;
		}
		hidePasswordChangeModal();
		showSavedMessage = true;
		if (messageTimeout) {
			clearTimeout(messageTimeout);
		}
		messageTimeout = window.setTimeout(() => {
			showSavedMessage = false;
		}, 3000);
	}

	function showDeleteAccountConfirm() {
		showDeleteConfirm = true;
	}

	function hideDeleteAccountConfirm() {
		showDeleteConfirm = false;
	}

	function handleDeleteAccount() {
		localStorage.clear();
		alert('Account deleted successfully.');
		window.location.href = '/';
	}

	function handleLogout() {
		if (confirm('Are you sure you want to logout?')) {
			localStorage.removeItem('gym-app-user-profile');
			window.location.href = '/';
		}
	}

	function handleBack() {
		window.location.href = '/';
	}

	async function handleSync() {
		isSyncing = true;
		syncResult = null;
		const result = await syncManager.sync((progress) => {
			exportProgress = {
				current: progress.current,
				total: progress.total,
				stage: progress.stage
			};
		});
		isSyncing = false;
		syncResult = { success: result.success, message: formatSyncMessage(result) };

		showSavedMessage = result.success;
		if (messageTimeout) {
			clearTimeout(messageTimeout);
		}
		messageTimeout = window.setTimeout(() => {
			showSavedMessage = false;
			syncResult = null;
		}, 5000);
	}

	async function handleExport() {
		showExportProgress = true;
		exportResult = null;
		exportProgress = { current: 0, total: 0, stage: 'Starting...' };

		const result = await exportBackupData((current: number, total: number, stage: string) => {
			exportProgress = { current, total, stage };
		});

		exportResult = result;

		setTimeout(() => {
			showExportProgress = false;
		}, 3000);
	}

	function showImportBackupModal() {
		showImportModal = true;
	}

	function handleImportModalClose() {
		showImportModal = false;
	}

	const themeOptions = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'system', label: 'System Default' }
	];

	const weightUnitOptions = [
		{ value: 'kg', label: 'Kilograms (kg)' },
		{ value: 'lb', label: 'Pounds (lb)' }
	];

	const distanceUnitOptions = [
		{ value: 'km', label: 'Kilometers (km)' },
		{ value: 'miles', label: 'Miles' }
	];

	const decimalPlacesOptions = [
		{ value: 0, label: '0 decimal places (whole numbers)' },
		{ value: 1, label: '1 decimal place' },
		{ value: 2, label: '2 decimal places' }
	];

	const exportFormatOptions = [
		{ value: 'json', label: 'JSON (Recommended)' }
	];
</script>

<div class="min-h-screen bg-bg p-4 md:p-8">
	<div class="max-w-2xl mx-auto">
		<div class="flex items-center justify-between mb-6 flex-col sm:flex-row gap-4">
			<div class="flex items-center gap-4 w-full sm:w-auto">
				<Button variant="ghost" onclick={handleBack}>
					← Back
				</Button>
				<h1 class="text-3xl font-display font-bold text-text-primary">Settings</h1>
			</div>
			<Button onclick={saveSettings}>
				Save Settings
			</Button>
		</div>

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Account</h2>

				<div class="space-y-4">
					<TextInput
						bind:value={userProfile.name}
						label="Name"
						id="user-name"
						onblur={saveProfile}
					/>

					<TextInput
						bind:value={userProfile.email}
						label="Email"
						id="user-email"
						type="email"
						onblur={saveProfile}
					/>

					<div class="border-t border-border pt-4">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="font-medium text-text-primary">Account Status</h3>
								<span class="inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full {userProfile.status === 'active' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}">
									{userProfile.status}
								</span>
							</div>
						</div>
					</div>

					<div class="border-t border-border pt-4">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="font-medium text-text-primary">Password</h3>
								<p class="text-sm text-text-secondary">Change your password</p>
							</div>
							<Button variant="ghost" onclick={showPasswordChangeModal}>
								Change
							</Button>
						</div>
					</div>

					<div class="border-t border-border pt-4">
						<Button variant="ghost" fullWidth onclick={handleLogout}>
							Logout
						</Button>
					</div>

					<div class="border-t border-border pt-4">
						<Button variant="danger" fullWidth onclick={showDeleteAccountConfirm}>
							Delete Account
						</Button>
						<p class="mt-2 text-sm text-text-muted">This action cannot be undone. All your data will be permanently deleted.</p>
					</div>
				</div>
			{/snippet}
		</Card>

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Notifications</h2>

				<div class="space-y-4">
					<Toggle
						bind:checked={notificationPreferences.workoutReminders}
						label="Workout Reminders"
						description="Get notified about upcoming workouts"
					/>

					<div class="border-t border-border pt-4">
						<Toggle
							bind:checked={notificationPreferences.prAchievements}
							label="PR Achievements"
							description="Celebrate new personal records"
						/>
					</div>

					<div class="border-t border-border pt-4">
						<Toggle
							bind:checked={notificationPreferences.progressUpdates}
							label="Progress Updates"
							description="Weekly progress summaries"
						/>
					</div>

					<div class="border-t border-border pt-4">
						<Toggle
							bind:checked={notificationPreferences.emailNotifications}
							label="Email Notifications"
							description="Receive updates via email"
						/>
					</div>
				</div>
			{/snippet}
		</Card>

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Rest Timer</h2>

				<div class="space-y-4">
					<TextInput
						bind:value={settings.defaultRestDuration}
						label="Default Rest Duration (seconds)"
						id="default-rest-duration"
						type="number"
						min={10}
						max={300}
						inputmode="numeric"
						hint="Duration automatically used when rest timer starts"
					/>

					<div class="border-t border-border pt-4">
						<Toggle
							bind:checked={settings.soundEnabled}
							label="Sound Notifications"
							description="Play sound when timer completes"
						/>
					</div>

					<div class="border-t border-border pt-4">
						<Toggle
							bind:checked={settings.vibrationEnabled}
							label="Vibration"
							description="Vibrate when timer completes"
						/>
					</div>
				</div>
			{/snippet}
		</Card>

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">App Preferences</h2>

				<div class="space-y-4">
					<Select
						bind:value={appPreferences.theme}
						options={themeOptions}
						label="App Theme"
						id="theme"
						onchange={saveAppPreferences}
						hint="Choose your preferred color scheme"
					/>

					<div class="border-t border-border pt-4">
						<Select
							bind:value={appPreferences.weightUnit}
							options={weightUnitOptions}
							label="Weight Unit"
							id="weight-unit"
							onchange={saveAppPreferences}
							hint="Unit for displaying weight values"
						/>
					</div>

					<div class="border-t border-border pt-4">
						<Select
							bind:value={appPreferences.distanceUnit}
							options={distanceUnitOptions}
							label="Distance Unit"
							id="distance-unit"
							onchange={saveAppPreferences}
							hint="Unit for displaying distance values"
						/>
					</div>

					<div class="border-t border-border pt-4">
						<Select
							bind:value={appPreferences.decimalPlaces}
							options={decimalPlacesOptions}
							label="Decimal Places"
							id="decimal-places"
							onchange={saveAppPreferences}
							hint="Precision for displaying numeric values"
						/>
					</div>
				</div>
			{/snippet}
		</Card>

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Data Management</h2>

				<div class="space-y-4">
					<Select
						bind:value={exportFormat}
						options={exportFormatOptions}
						label="Export File Format"
						id="export-format"
						hint="Choose the format for exported data files"
					/>

					<div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
						<Button onclick={handleExport} disabled={showExportProgress} class="flex-1">
							<span class="text-lg">📤</span>
							<span>Export Data</span>
						</Button>
						<Button variant="success" onclick={showImportBackupModal} class="flex-1">
							<span class="text-lg">📥</span>
							<span>Import Data</span>
						</Button>
					</div>

					<div class="bg-surface-elevated border border-border rounded-lg p-4">
						<h3 class="font-medium text-text-primary mb-2">ℹ️ About Import/Export</h3>
						<ul class="text-sm text-text-secondary space-y-1">
							<li>• Export creates a backup file with all your workout data</li>
							<li>• Import restores data from a previously exported backup</li>
							<li>• You can choose how to handle duplicate items during import</li>
							<li>• Store backup files in a safe location for data security</li>
						</ul>
					</div>
				</div>
			{/snippet}
		</Card>

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Data Sync</h2>

				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-medium text-text-primary">Connection Status</h3>
							<p class="text-sm text-text-secondary">
								{syncManager.isOnline() ? 'You are online - changes will sync automatically' : 'You are offline - changes will sync when connection is restored'}
							</p>
						</div>
						<SyncIndicator />
					</div>

					<div class="border-t border-border pt-4">
						<h3 class="font-medium text-text-primary mb-2">Manual Sync</h3>
						<p class="text-sm text-text-secondary mb-3">
							Force sync your data to the cloud. Pending changes will be uploaded immediately.
						</p>
						<Button
							onclick={handleSync}
							disabled={isSyncing || !syncManager.isOnline()}
							loading={isSyncing}
						>
							{#if !isSyncing}
								<span class="text-lg">🔄</span>
							{/if}
							<span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
						</Button>
					</div>

					{#if syncResult}
						<InfoBox type={syncResult.success ? 'success' : 'error'}>
							{syncResult.message}
						</InfoBox>
					{/if}

					{#if isSyncing && exportProgress.total > 0}
						<InfoBox type="info">
							<div class="flex items-center justify-between mb-2">
								<span class="text-sm font-medium">{exportProgress.stage}</span>
								<span class="text-xs">{exportProgress.current}/{exportProgress.total}</span>
							</div>
							<div class="w-full bg-secondary/30 rounded-full h-2">
								<div
									class="bg-accent h-2 rounded-full transition-all duration-300"
									style="width: {(exportProgress.current / exportProgress.total) * 100}%"
								></div>
							</div>
						</InfoBox>
					{/if}

					<div class="bg-surface-elevated border border-border rounded-lg p-4">
						<h3 class="font-medium text-text-primary mb-2">ℹ️ About Sync</h3>
						<ul class="text-sm text-text-secondary space-y-1">
							<li>• Changes sync automatically when online</li>
							<li>• Data is queued when offline and syncs when connection restores</li>
							<li>• Failed syncs retry automatically with exponential backoff</li>
							<li>• Last write wins in case of conflicts</li>
						</ul>
					</div>
				</div>
			{/snippet}
		</Card>

		<InfoBox type="info" title="Tips">
			<ul class="space-y-1">
				<li>• You can manually adjust the timer duration during your workout</li>
				<li>• Skip the timer anytime to move to the next set</li>
				<li>• Sound and vibration will alert you when rest period ends</li>
				<li>• Typical rest periods: 2-3 minutes for compound exercises, 1-2 minutes for isolation</li>
			</ul>
		</InfoBox>

		<Modal open={showPasswordChange} title="Change Password" size="sm" onclose={hidePasswordChangeModal}>
			{#snippet children()}
				<div class="space-y-4">
					<TextInput
						bind:value={newPassword}
						label="New Password"
						id="new-password"
						type="password"
						placeholder="Enter new password"
						autofocus
					/>
					<TextInput
						bind:value={confirmNewPassword}
						label="Confirm New Password"
						id="confirm-password"
						type="password"
						placeholder="Confirm new password"
					/>
					<p class="text-sm text-text-muted">Password must be at least 8 characters long.</p>
				</div>
			{/snippet}
			{#snippet footer()}
				<div class="flex justify-end gap-3">
					<Button variant="secondary" onclick={hidePasswordChangeModal}>
						Cancel
					</Button>
					<Button onclick={handlePasswordChange}>
						Change Password
					</Button>
				</div>
			{/snippet}
		</Modal>

		<ConfirmDialog
			open={showDeleteConfirm}
			title="Delete Account"
			message="This action cannot be undone. All your data, including workouts, exercises, and personal records, will be permanently deleted."
			confirmText="Delete Account"
			cancelText="Cancel"
			confirmVariant="danger"
			onconfirm={handleDeleteAccount}
			oncancel={hideDeleteAccountConfirm}
		/>

		{#if showSavedMessage}
			<div class="fixed bottom-4 right-4 bg-success text-bg px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
				<span class="text-xl">✓</span>
				<span>Settings saved!</span>
			</div>
		{/if}

		{#if showExportProgress}
			<div class="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50" role="presentation">
				<div class="bg-surface border border-border rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-xl font-bold text-text-primary">Exporting Data</h3>
					</div>

					{#if exportResult === null}
						<div class="space-y-4">
							<div class="flex items-center gap-2">
								<div class="flex-1 bg-surface-elevated rounded-full h-2 overflow-hidden">
									<div
										class="bg-accent h-full transition-all duration-300"
										style:width={exportProgress.total > 0 ? `${(exportProgress.current / exportProgress.total) * 100}%` : '0%'}
									></div>
								</div>
								<span class="text-sm text-text-secondary font-medium min-w-[3rem]">
									{exportProgress.total > 0 ? `${Math.round((exportProgress.current / exportProgress.total) * 100)}%` : '0%'}
								</span>
							</div>
							<p class="text-sm text-text-secondary">{exportProgress.stage}</p>
						</div>
					{:else if exportResult.success}
						<div class="space-y-3">
							<div class="flex items-center gap-2 text-success">
								<span class="text-2xl">✅</span>
								<p class="font-medium">Export Complete!</p>
							</div>
							<p class="text-sm text-text-secondary">{exportResult.message}</p>
							<p class="text-sm text-text-muted">File has been downloaded to your default download location.</p>
						</div>
					{:else}
						<div class="space-y-3">
							<div class="flex items-center gap-2 text-danger">
								<span class="text-2xl">❌</span>
								<p class="font-medium">Export Failed</p>
							</div>
							<p class="text-sm text-text-secondary">{exportResult.message}</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if showImportModal}
			<ImportBackupModal onClose={handleImportModalClose} />
		{/if}
	</div>
</div>
