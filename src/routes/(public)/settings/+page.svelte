<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import type { AppSettings, NotificationPreferences, AppPreferences } from '$lib/types';
	import ImportBackupModal from '$lib/components/ImportBackupModal.svelte';
	import SyncIndicator from '$lib/components/SyncIndicator.svelte';
	import { exportBackupData } from '$lib/backupUtils';
	import { syncManager, formatLastSyncTime } from '$lib/syncUtils';
	import { formatSyncMessage } from '$lib/syncUtils';
	import {
		syncKey,
		isSyncing as isSyncingStore,
		lastSyncTime,
		generateSyncKey,
		setSyncKey,
		clearSyncKey
	} from '$lib/syncService';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { Button, TextInput, Select, Toggle, Card, Modal, InfoBox, PageHeader, NumberSpinner } from '$lib/ui';
	import { seedDemoData } from '$lib/db';

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

	let notificationPreferences = $state<NotificationPreferences>({
		workoutReminders: true,
		prAchievements: true,
		progressUpdates: false,
		emailNotifications: false
	});

	let showImportModal = $state(false);
	let showExportProgress = $state(false);
	let exportProgress = $state({ current: 0, total: 0, stage: '' });
	let exportResult = $state<{ success: boolean; message: string } | null>(null);
	let exportFormat = $state<'json'>('json');
	let isSyncing = $state(false);

	// Sync key state
	let currentSyncKey = $state<string | null>(null);
	let currentLastSyncTime = $state<number | null>(null);
	let enterKeyInput = $state('');
	let showEnterKeyModal = $state(false);
	let isGeneratingKey = $state(false);
	let isEnteringKey = $state(false);
	let syncKeyError = $state<string | null>(null);
	let showCopiedMessage = $state(false);
	let hasLoaded = $state(false);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;

	// Auto-save settings when they change (with debounce)
	$effect(() => {
		// Read all settings to create dependencies
		const _ = JSON.stringify(settings) + JSON.stringify(appPreferences) + JSON.stringify(notificationPreferences);

		// Don't save on initial load
		if (!hasLoaded) return;

		// Debounce saves
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			localStorage.setItem('gym-app-settings', JSON.stringify(settings));
			localStorage.setItem('gym-app-notification-prefs', JSON.stringify(notificationPreferences));
			localStorage.setItem('gym-app-preferences', JSON.stringify(appPreferences));
		}, 300);
	});

	// Subscribe to sync stores
	$effect(() => {
		const unsubKey = syncKey.subscribe((value) => {
			currentSyncKey = value;
		});
		const unsubTime = lastSyncTime.subscribe((value) => {
			currentLastSyncTime = value;
		});
		const unsubSyncing = isSyncingStore.subscribe((value) => {
			isSyncing = value;
		});

		return () => {
			unsubKey();
			unsubTime();
			unsubSyncing();
		};
	});

	onMount(() => {
		loadSettings();
		loadNotificationPreferences();
		loadAppPreferences();
		// Mark as loaded after initial load to enable auto-save
		hasLoaded = true;
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


	async function handleSync() {
		isSyncing = true;

		// Run sync with a minimum 500ms delay to avoid jarring UI
		const minDelay = new Promise((resolve) => setTimeout(resolve, 500));
		const [result] = await Promise.all([
			syncManager.sync((progress) => {
				exportProgress = {
					current: progress.current,
					total: progress.total,
					stage: progress.stage
				};
			}),
			minDelay
		]);

		isSyncing = false;

		if (result.success) {
			toastStore.showSuccess(result.message);
		} else {
			toastStore.showError(result.message);
		}
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

	async function handleLoadDemoData() {
		try {
			await seedDemoData();
			toastStore.showSuccess('Demo data loaded! Check your workouts.');
		} catch (e) {
			console.error('Failed to load demo data:', e);
			toastStore.showError('Failed to load demo data');
		}
	}

	async function handleGenerateSyncKey() {
		isGeneratingKey = true;

		const result = await generateSyncKey();

		isGeneratingKey = false;

		if (result.success) {
			toastStore.showSuccess('Sync key generated! Your data has been synced.');
		} else {
			toastStore.showError(result.error || 'Failed to generate sync key');
		}
	}

	function handleShowEnterKeyModal() {
		enterKeyInput = '';
		syncKeyError = null;
		showEnterKeyModal = true;
	}

	function handleCloseEnterKeyModal() {
		showEnterKeyModal = false;
		enterKeyInput = '';
		syncKeyError = null;
	}

	async function handleEnterSyncKey() {
		if (!enterKeyInput.trim()) {
			syncKeyError = 'Please enter a sync key';
			return;
		}

		isEnteringKey = true;
		syncKeyError = null;

		const result = await setSyncKey(enterKeyInput.trim());

		isEnteringKey = false;

		if (result.success) {
			showEnterKeyModal = false;
			enterKeyInput = '';
			toastStore.showSuccess('Sync key connected! Your data has been synced.');
		} else {
			toastStore.showError(result.error || 'Failed to connect sync key');
		}
	}

	function handleDisconnectSync() {
		if (confirm('Are you sure you want to disconnect? Your data will remain on this device but will no longer sync.')) {
			clearSyncKey();
			toastStore.showInfo('Sync disconnected.');
		}
	}

	async function handleCopySyncKey() {
		if (currentSyncKey) {
			try {
				await navigator.clipboard.writeText(currentSyncKey);
				showCopiedMessage = true;
				setTimeout(() => {
					showCopiedMessage = false;
				}, 2000);
			} catch {
				alert('Failed to copy. Your sync key is: ' + currentSyncKey);
			}
		}
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
		<PageHeader title="Settings" />

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Data Sync</h2>

				<div class="space-y-4">
					{#if currentSyncKey}
						<!-- Sync is enabled - show key and controls -->
						<div class="bg-surface-elevated border border-border rounded-lg p-4">
							<div class="flex items-center justify-between mb-2">
								<h3 class="font-medium text-text-primary">Your Sync Key</h3>
								<span class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-success/20 text-success">
									<span class="w-2 h-2 bg-success rounded-full"></span>
									Connected
								</span>
							</div>
							<div class="flex items-center gap-2">
								<code class="flex-1 bg-bg px-3 py-2 rounded text-sm font-mono text-text-secondary break-all">
									{currentSyncKey}
								</code>
								<Button variant="ghost" onclick={handleCopySyncKey}>
									{showCopiedMessage ? '✓' : '📋'}
								</Button>
							</div>
							<p class="mt-2 text-xs text-text-muted">
								Save this key somewhere safe. Use it on other devices to sync your data.
							</p>
						</div>

						<div class="flex items-center justify-between">
							<div>
								<h3 class="font-medium text-text-primary">Last Synced</h3>
								<p class="text-sm text-text-secondary">
									{formatLastSyncTime(currentLastSyncTime)}
								</p>
							</div>
							<SyncIndicator position="inline" />
						</div>

						<div class="border-t border-border pt-4">
							<div class="flex flex-col sm:flex-row gap-3">
								<Button
									onclick={handleSync}
									disabled={isSyncing || !syncManager.isOnline()}
									loading={isSyncing}
									class="flex-1"
								>
									Sync Now
								</Button>
								<Button variant="ghost" onclick={handleDisconnectSync}>
									Disconnect
								</Button>
							</div>
						</div>
					{:else}
						<!-- Sync not enabled - show setup options -->
						<div class="text-center py-4">
							<p class="text-text-secondary mb-4">
								Enable sync to keep your data synchronized across devices.
							</p>
							<div class="flex flex-col sm:flex-row gap-3 justify-center">
								<Button
									onclick={handleGenerateSyncKey}
									disabled={isGeneratingKey}
									loading={isGeneratingKey}
								>
									{isGeneratingKey ? 'Generating...' : 'Generate New Key'}
								</Button>
								<Button variant="secondary" onclick={handleShowEnterKeyModal}>
									Enter Existing Key
								</Button>
							</div>
						</div>
					{/if}

					<div class="bg-surface-elevated border border-border rounded-lg p-4">
						<h3 class="font-medium text-text-primary mb-2">ℹ️ About Sync</h3>
						<ul class="text-sm text-text-secondary space-y-1">
							<li>• Your sync key is like a password - keep it safe</li>
							<li>• Use the same key on all your devices to sync data</li>
							<li>• Changes sync automatically when online</li>
							<li>• Last write wins in case of conflicts</li>
						</ul>
					</div>
				</div>
			{/snippet}
		</Card>

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Rest Timer</h2>

				<div class="space-y-4">
					<NumberSpinner
						bind:value={settings.defaultRestDuration}
						label="Default Rest Duration (seconds)"
						id="default-rest-duration"
						min={10}
						max={300}
						step={5}
						size="sm"
					/>
					<p class="mt-1 text-sm text-text-muted">Duration automatically used when rest timer starts</p>

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
						hint="Choose your preferred color scheme"
					/>

					<div class="border-t border-border pt-4">
						<Select
							bind:value={appPreferences.weightUnit}
							options={weightUnitOptions}
							label="Weight Unit"
							id="weight-unit"
								hint="Unit for displaying weight values"
						/>
					</div>

					<div class="border-t border-border pt-4">
						<Select
							bind:value={appPreferences.distanceUnit}
							options={distanceUnitOptions}
							label="Distance Unit"
							id="distance-unit"
								hint="Unit for displaying distance values"
						/>
					</div>

					<div class="border-t border-border pt-4">
						<Select
							bind:value={appPreferences.decimalPlaces}
							options={decimalPlacesOptions}
							label="Decimal Places"
							id="decimal-places"
								hint="Precision for displaying numeric values"
						/>
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

		<Card class="mb-6 mt-6">
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

					{#if dev}
					<div class="pt-4 border-t border-border">
						<h3 class="font-medium text-text-primary mb-2">Demo Data</h3>
						<p class="text-sm text-text-secondary mb-3">Load sample workouts and sessions to test the app.</p>
						<Button variant="secondary" onclick={handleLoadDemoData}>
							Load Demo Data
						</Button>
					</div>
					{/if}
				</div>
			{/snippet}
		</Card>

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

		<Modal open={showEnterKeyModal} title="Enter Sync Key" size="sm" onclose={handleCloseEnterKeyModal}>
			{#snippet children()}
				<div class="space-y-4">
					<p class="text-sm text-text-secondary">
						Enter your sync key to connect this device to your existing data.
					</p>
					<TextInput
						bind:value={enterKeyInput}
						label="Sync Key"
						id="sync-key-input"
						placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
						autofocus
					/>
					{#if syncKeyError}
						<p class="text-sm text-danger">{syncKeyError}</p>
					{/if}
				</div>
			{/snippet}
			{#snippet footer()}
				<div class="flex justify-end gap-3">
					<Button variant="secondary" onclick={handleCloseEnterKeyModal}>
						Cancel
					</Button>
					<Button onclick={handleEnterSyncKey} disabled={isEnteringKey} loading={isEnteringKey}>
						{isEnteringKey ? 'Connecting...' : 'Connect'}
					</Button>
				</div>
			{/snippet}
		</Modal>
	</div>
</div>
