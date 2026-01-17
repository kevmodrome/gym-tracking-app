<script lang="ts">
	import { onMount } from 'svelte';
	import type { AppSettings, UserProfile, NotificationPreferences, AppPreferences } from '$lib/types';
	import XIcon from '$lib/components/XIcon.svelte';
	import ImportBackupModal from '$lib/components/ImportBackupModal.svelte';
	import SyncIndicator from '$lib/components/SyncIndicator.svelte';
	import { exportBackupData } from '$lib/backupUtils';
	import { syncManager } from '$lib/syncUtils';
	import { formatSyncMessage } from '$lib/syncUtils';

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
		if (confirm('This action cannot be undone. All your data will be permanently deleted. Are you sure you want to proceed?')) {
			localStorage.clear();
			alert('Account deleted successfully.');
			window.location.href = '/';
		}
		hideDeleteAccountConfirm();
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
</script>

	<div class="min-h-screen bg-gray-100 p-4 md:p-8">
		<div class="max-w-2xl mx-auto">
			<div class="flex items-center justify-between mb-6 flex-col sm:flex-row gap-4">
				<div class="flex items-center gap-4 w-full sm:w-auto">
					<button
						onclick={handleBack}
						class="px-4 py-3 text-base bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors min-h-[44px]"
						type="button"
					>
						← Back
					</button>
					<h1 class="text-3xl font-bold text-gray-900">Settings</h1>
				</div>
				<button
					onclick={saveSettings}
					class="flex items-center gap-2 px-4 py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
					type="button"
				>
					Save Settings
				</button>
			</div>

		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Account</h2>

			<div class="space-y-4">
				<div>
					<label for="user-name" class="block text-sm font-medium text-gray-700 mb-2">
						Name
					</label>
					<input
						id="user-name"
						type="text"
						bind:value={userProfile.name}
						onblur={saveProfile}
						class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
					/>
				</div>

				<div>
					<label for="user-email" class="block text-sm font-medium text-gray-700 mb-2">
						Email
					</label>
					<input
						id="user-email"
						type="email"
						bind:value={userProfile.email}
						onblur={saveProfile}
						class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
					/>
				</div>

				<div class="border-t border-gray-200 pt-4">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-medium text-gray-900">Account Status</h3>
							<span class="inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full {userProfile.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
								{userProfile.status}
							</span>
						</div>
					</div>
				</div>

				<div class="border-t border-gray-200 pt-4">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-medium text-gray-900">Password</h3>
							<p class="text-sm text-gray-600">Change your password</p>
						</div>
						<button
							onclick={showPasswordChangeModal}
							class="px-4 py-3 text-base bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors min-h-[44px]"
							type="button"
						>
							Change
						</button>
					</div>
				</div>

				<div class="border-t border-gray-200 pt-4">
					<button
						onclick={handleLogout}
						class="w-full px-4 py-3 text-base bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors min-h-[44px]"
						type="button"
					>
						Logout
					</button>
				</div>

				<div class="border-t border-gray-200 pt-4">
					<button
						onclick={showDeleteAccountConfirm}
						class="w-full px-4 py-3 text-base bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors min-h-[44px]"
						type="button"
					>
						Delete Account
					</button>
					<p class="mt-2 text-sm text-gray-500">This action cannot be undone. All your data will be permanently deleted.</p>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Notifications</h2>

			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="font-medium text-gray-900">Workout Reminders</h3>
						<p class="text-sm text-gray-600">Get notified about upcoming workouts</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							bind:checked={notificationPreferences.workoutReminders}
							class="sr-only peer"
						/>
						<div
							class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
						></div>
					</label>
				</div>

				<div class="flex items-center justify-between border-t border-gray-200 pt-4">
					<div>
						<h3 class="font-medium text-gray-900">PR Achievements</h3>
						<p class="text-sm text-gray-600">Celebrate new personal records</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							bind:checked={notificationPreferences.prAchievements}
							class="sr-only peer"
						/>
						<div
							class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
						></div>
					</label>
				</div>

				<div class="flex items-center justify-between border-t border-gray-200 pt-4">
					<div>
						<h3 class="font-medium text-gray-900">Progress Updates</h3>
						<p class="text-sm text-gray-600">Weekly progress summaries</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							bind:checked={notificationPreferences.progressUpdates}
							class="sr-only peer"
						/>
						<div
							class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
						></div>
					</label>
				</div>

				<div class="flex items-center justify-between border-t border-gray-200 pt-4">
					<div>
						<h3 class="font-medium text-gray-900">Email Notifications</h3>
						<p class="text-sm text-gray-600">Receive updates via email</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							bind:checked={notificationPreferences.emailNotifications}
							class="sr-only peer"
						/>
						<div
							class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
						></div>
					</label>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Rest Timer</h2>

			<div class="space-y-4">
				<div>
					<label for="default-rest-duration" class="block text-sm font-medium text-gray-700 mb-2">
						Default Rest Duration (seconds)
					</label>
					<input
						id="default-rest-duration"
						type="number"
						min="10"
						max="300"
						inputmode="numeric"
						bind:value={settings.defaultRestDuration}
						class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
					/>
					<p class="mt-1 text-sm text-gray-500">
						Duration automatically used when rest timer starts
					</p>
				</div>

				<div class="flex items-center justify-between border-t border-gray-200 pt-4">
					<div>
						<h3 class="font-medium text-gray-900">Sound Notifications</h3>
						<p class="text-sm text-gray-600">Play sound when timer completes</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							bind:checked={settings.soundEnabled}
							class="sr-only peer"
						/>
						<div
							class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
						></div>
					</label>
				</div>

				<div class="flex items-center justify-between border-t border-gray-200 pt-4">
					<div>
						<h3 class="font-medium text-gray-900">Vibration</h3>
						<p class="text-sm text-gray-600">Vibrate when timer completes</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							bind:checked={settings.vibrationEnabled}
							class="sr-only peer"
						/>
						<div
							class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
						></div>
					</label>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-bold text-gray-900 mb-4">App Preferences</h2>

			<div class="space-y-4">
				<div>
					<label for="theme" class="block text-sm font-medium text-gray-700 mb-2">
						App Theme
					</label>
					<select
						id="theme"
						bind:value={appPreferences.theme}
						onchange={saveAppPreferences}
						class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
					>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
						<option value="system">System Default</option>
					</select>
					<p class="mt-1 text-sm text-gray-500">
						Choose your preferred color scheme
					</p>
				</div>

				<div class="border-t border-gray-200 pt-4">
					<label for="weight-unit" class="block text-sm font-medium text-gray-700 mb-2">
						Weight Unit
					</label>
					<select
						id="weight-unit"
						bind:value={appPreferences.weightUnit}
						onchange={saveAppPreferences}
						class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
					>
						<option value="kg">Kilograms (kg)</option>
						<option value="lb">Pounds (lb)</option>
					</select>
					<p class="mt-1 text-sm text-gray-500">
						Unit for displaying weight values
					</p>
				</div>

				<div class="border-t border-gray-200 pt-4">
					<label for="distance-unit" class="block text-sm font-medium text-gray-700 mb-2">
						Distance Unit
					</label>
					<select
						id="distance-unit"
						bind:value={appPreferences.distanceUnit}
						onchange={saveAppPreferences}
						class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
					>
						<option value="km">Kilometers (km)</option>
						<option value="miles">Miles</option>
					</select>
					<p class="mt-1 text-sm text-gray-500">
						Unit for displaying distance values
					</p>
				</div>

				<div class="border-t border-gray-200 pt-4">
					<label for="decimal-places" class="block text-sm font-medium text-gray-700 mb-2">
						Decimal Places
					</label>
					<select
						id="decimal-places"
						bind:value={appPreferences.decimalPlaces}
						onchange={saveAppPreferences}
						class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
					>
						<option value={0}>0 decimal places (whole numbers)</option>
						<option value={1}>1 decimal place</option>
						<option value={2}>2 decimal places</option>
					</select>
					<p class="mt-1 text-sm text-gray-500">
						Precision for displaying numeric values
					</p>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Data Management</h2>

			<div class="space-y-4">
				<div>
					<label for="export-format" class="block text-sm font-medium text-gray-700 mb-2">
						Export File Format
					</label>
					<select
						id="decimal-places"
						bind:value={appPreferences.decimalPlaces}
						onchange={saveAppPreferences}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						<option value={0}>0 decimal places (whole numbers)</option>
						<option value={1}>1 decimal place</option>
						<option value={2}>2 decimal places</option>
					</select>
					<p class="mt-1 text-sm text-gray-500">
						Precision for displaying numeric values
					</p>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Data Management</h2>

			<div class="space-y-4">
				<div>
					<label for="export-format" class="block text-sm font-medium text-gray-700 mb-2">
						Export File Format
					</label>
					<select
						id="export-format"
						bind:value={exportFormat}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						<option value="json">JSON (Recommended)</option>
					</select>
					<p class="mt-1 text-sm text-gray-500">
						Choose the format for exported data files
					</p>
				</div>

				<div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
					<button
						onclick={handleExport}
						disabled={showExportProgress}
						type="button"
						class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
					>
						<span class="text-lg">📤</span>
						<span>Export Data</span>
					</button>
					<button
						onclick={showImportBackupModal}
						type="button"
						class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
					>
						<span class="text-lg">📥</span>
						<span>Import Data</span>
					</button>
				</div>

				<div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
					<h3 class="font-medium text-gray-900 mb-2">ℹ️ About Import/Export</h3>
					<ul class="text-sm text-gray-600 space-y-1">
						<li>• Export creates a backup file with all your workout data</li>
						<li>• Import restores data from a previously exported backup</li>
						<li>• You can choose how to handle duplicate items during import</li>
						<li>• Store backup files in a safe location for data security</li>
					</ul>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Data Sync</h2>

			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="font-medium text-gray-900">Connection Status</h3>
						<p class="text-sm text-gray-600">
							{syncManager.isOnline() ? 'You are online - changes will sync automatically' : 'You are offline - changes will sync when connection is restored'}
						</p>
					</div>
					<SyncIndicator />
				</div>

				<div class="border-t border-gray-200 pt-4">
					<h3 class="font-medium text-gray-900 mb-2">Manual Sync</h3>
					<p class="text-sm text-gray-600 mb-3">
						Force sync your data to the cloud. Pending changes will be uploaded immediately.
					</p>
					<button
						onclick={handleSync}
						disabled={isSyncing || !syncManager.isOnline()}
						type="button"
						class="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
					>
						{#if isSyncing}
							<svg
								class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							Syncing...
						{:else}
							<span class="text-lg">🔄</span>
							<span>Sync Now</span>
						{/if}
					</button>
				</div>

				{#if syncResult}
					<div class="p-3 rounded-lg {syncResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}">
						<p class="text-sm">{syncResult.message}</p>
					</div>
				{/if}

				{#if isSyncing && exportProgress.total > 0}
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
						<div class="flex items-center justify-between mb-2">
							<span class="text-sm font-medium text-blue-900">{exportProgress.stage}</span>
							<span class="text-xs text-blue-700"
								>{exportProgress.current}/{exportProgress.total}</span
							>
						</div>
						<div class="w-full bg-blue-200 rounded-full h-2">
							<div
								class="bg-blue-600 h-2 rounded-full transition-all duration-300"
								style="width: {(exportProgress.current / exportProgress.total) * 100}%"
							></div>
						</div>
					</div>
				{/if}

				<div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
					<h3 class="font-medium text-gray-900 mb-2">ℹ️ About Sync</h3>
					<ul class="text-sm text-gray-600 space-y-1">
						<li>• Changes sync automatically when online</li>
						<li>• Data is queued when offline and syncs when connection restores</li>
						<li>• Failed syncs retry automatically with exponential backoff</li>
						<li>• Last write wins in case of conflicts</li>
					</ul>
				</div>
			</div>
		</div>

		<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
			<h3 class="font-semibold text-blue-900 mb-2">Tips</h3>
			<ul class="text-sm text-blue-800 space-y-1">
				<li>• You can manually adjust the timer duration during your workout</li>
				<li>• Skip the timer anytime to move to the next set</li>
				<li>• Sound and vibration will alert you when rest period ends</li>
				<li>• Typical rest periods: 2-3 minutes for compound exercises, 1-2 minutes for isolation</li>
			</ul>
		</div>

		{#if showPasswordChange}
			<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
				<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-xl font-bold text-gray-900">Change Password</h3>
						<button
							onclick={hidePasswordChangeModal}
							class="text-gray-400 hover:text-gray-600"
							type="button"
						>
							<XIcon />
						</button>
					</div>
					<div class="space-y-4">
						<div>
							<label for="new-password" class="block text-sm font-medium text-gray-700 mb-2">
								New Password
							</label>
							<!-- svelte-ignore a11y_autofocus -->
							<!-- User-initiated password change: autofocus guides to primary input -->
							<input
								id="new-password"
								type="password"
								bind:value={newPassword}
								placeholder="Enter new password"
								autofocus
								class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
							/>

						</div>
						<div>
							<label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-2">
								Confirm New Password
							</label>
							<input
								id="confirm-password"
								type="password"
								bind:value={confirmNewPassword}
								placeholder="Confirm new password"
								class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
							/>
						</div>
						<p class="text-sm text-gray-500">Password must be at least 8 characters long.</p>
						<div class="flex justify-end gap-3">
							<button
								onclick={hidePasswordChangeModal}
								class="px-4 py-3 text-base bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors min-h-[44px]"
								type="button"
							>
								Cancel
							</button>
							<button
								onclick={handlePasswordChange}
								class="px-4 py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
								type="button"
							>
								Change Password
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if showDeleteConfirm}
			<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
				<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-xl font-bold text-red-900">Delete Account</h3>
						<button
							onclick={hideDeleteAccountConfirm}
							class="text-gray-400 hover:text-gray-600"
							type="button"
						>
							<XIcon />
						</button>
					</div>
					<div class="space-y-4">
						<div class="bg-red-50 border border-red-200 rounded-lg p-4">
							<h4 class="font-semibold text-red-900 mb-2">⚠️ Warning</h4>
							<p class="text-sm text-red-800">
								This action cannot be undone. All your data, including workouts, exercises, and personal records, will be permanently deleted.
							</p>
						</div>
						<div class="flex justify-end gap-3">
							<button
								onclick={hideDeleteAccountConfirm}
								class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
								type="button"
							>
								Cancel
							</button>
							<button
								onclick={handleDeleteAccount}
								class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
								type="button"
							>
								Delete Account
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if showSavedMessage}
			<div class="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
				<span class="text-xl">✓</span>
				<span>Settings saved!</span>
			</div>
		{/if}

		{#if showExportProgress}
			<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
				<div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-xl font-bold text-gray-900">Exporting Data</h3>
					</div>

					{#if exportResult === null}
						<div class="space-y-4">
							<div class="flex items-center gap-2">
								<div class="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
									<div
										class="bg-blue-600 h-full transition-all duration-300"
										style:width={exportProgress.total > 0 ? `${(exportProgress.current / exportProgress.total) * 100}%` : '0%'}
									></div>
								</div>
								<span class="text-sm text-gray-600 font-medium min-w-[3rem]">
									{exportProgress.total > 0 ? `${Math.round((exportProgress.current / exportProgress.total) * 100)}%` : '0%'}
								</span>
							</div>
							<p class="text-sm text-gray-600">{exportProgress.stage}</p>
						</div>
					{:else if exportResult.success}
						<div class="space-y-3">
							<div class="flex items-center gap-2 text-green-600">
								<span class="text-2xl">✅</span>
								<p class="font-medium">Export Complete!</p>
							</div>
							<p class="text-sm text-gray-600">{exportResult.message}</p>
							<p class="text-sm text-gray-500">File has been downloaded to your default download location.</p>
						</div>
					{:else}
						<div class="space-y-3">
							<div class="flex items-center gap-2 text-red-600">
								<span class="text-2xl">❌</span>
								<p class="font-medium">Export Failed</p>
							</div>
							<p class="text-sm text-gray-600">{exportResult.message}</p>
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
