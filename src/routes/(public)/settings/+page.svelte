<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { dev } from '$app/environment';
	import type { AppSettings } from '$lib/types';
	import type { MemberRecord } from 'tablinum/svelte';
	import ImportBackupModal from '$lib/components/ImportBackupModal.svelte';
	import InviteModal from '$lib/components/InviteModal.svelte';
	import { exportBackupData } from '$lib/backupUtils';
	import { db, onMembersChanged } from '$lib/db';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { Button, Select, Toggle, Card, InfoBox, PageHeader, NumberSpinner } from '$lib/ui';
	import { seedDemoData } from '$lib/db';

	let settings = $state<AppSettings>({
		defaultRestDuration: 90,
		soundEnabled: true,
		vibrationEnabled: true
	});

	let showInviteModal = $state(false);
	let showImportModal = $state(false);
	let showExportProgress = $state(false);
	let exportProgress = $state({ current: 0, total: 0, stage: '' });
	let exportResult = $state<{ success: boolean; message: string } | null>(null);
	let hasLoaded = $state(false);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;

	// Sync status from Tablinum
	let syncStatus = $state(db.syncStatus);
	let pendingCount = $state(db.pendingCount);
	let relayStatus = $state(db.relayStatus);
	let members = $state<ReadonlyArray<MemberRecord>>([]);
	let deviceName = $state('');
	let isEditingName = $state(false);

	// Auto-save settings when they change (with debounce)
	$effect(() => {
		// Read all settings to create dependencies
		const _ = JSON.stringify(settings);

		// Don't save on initial load
		if (!hasLoaded) return;

		// Debounce saves
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			localStorage.setItem('gym-app-settings', JSON.stringify(settings));
		}, 300);
	});

	async function refreshMembers() {
		members = await db.getMembers();
	}

	const unsubMembers = onMembersChanged(refreshMembers);
	onDestroy(unsubMembers);

	onMount(async () => {
		loadSettings();
		hasLoaded = true;
		await refreshMembers();
		const profile = await db.getProfile();
		deviceName = profile.name ?? '';
	});

	async function saveDeviceName() {
		isEditingName = false;
		const trimmed = deviceName.trim();
		await db.setProfile({ name: trimmed || undefined });
		toastStore.showSuccess('Device name updated');
	}

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

	const weightUnitOptions = [
		{ value: 'kg', label: 'Kilograms (kg)' },
		{ value: 'lb', label: 'Pounds (lb)' }
	];

	const decimalPlacesOptions = [
		{ value: 0, label: '0 decimal places (whole numbers)' },
		{ value: 1, label: '1 decimal place' },
		{ value: 2, label: '2 decimal places' }
	];
</script>

<div class="min-h-screen bg-bg p-4 md:p-8">
	<div class="max-w-2xl mx-auto">
		<PageHeader title="Settings" />

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Sync</h2>

				<div class="space-y-4">
					<div class="bg-surface-elevated border border-border rounded-lg p-4">
						<div class="flex items-center justify-between mb-2">
							<h3 class="font-medium text-text-primary">Connection Status</h3>
							<span class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full {relayStatus.connectedUrls?.length > 0 ? 'bg-success/20 text-success' : 'bg-text-muted/20 text-text-muted'}">
								<span class="w-2 h-2 rounded-full {relayStatus.connectedUrls?.length > 0 ? 'bg-success' : 'bg-text-muted'}"></span>
								{relayStatus.connectedUrls?.length > 0 ? 'Connected' : 'Disconnected'}
							</span>
						</div>
						{#if relayStatus.connectedUrls?.length > 0}
							<p class="text-sm text-text-secondary">
								Connected to {relayStatus.connectedUrls.length} relay{relayStatus.connectedUrls.length > 1 ? 's' : ''}
							</p>
						{:else}
							<p class="text-sm text-text-secondary">
								Not connected to any relays
							</p>
						{/if}
					</div>

					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-medium text-text-primary">Sync Status</h3>
							<p class="text-sm text-text-secondary">
								{syncStatus === 'syncing' ? 'Syncing...' : 'Idle'}
								{#if pendingCount > 0}
									&bull; {pendingCount} pending change{pendingCount > 1 ? 's' : ''}
								{/if}
							</p>
						</div>
					</div>

					<div class="bg-surface-elevated border border-border rounded-lg p-4">
						<h3 class="font-medium text-text-primary mb-2">Devices</h3>
						<div class="space-y-2">
							<div class="flex items-center gap-2 text-sm">
								<span class="w-2 h-2 rounded-full bg-success flex-shrink-0"></span>
								{#if isEditingName}
									<input
										type="text"
										bind:value={deviceName}
										onkeydown={(e) => { if (e.key === 'Enter') saveDeviceName(); if (e.key === 'Escape') isEditingName = false; }}
										onblur={saveDeviceName}
										class="flex-1 min-w-0 px-2 py-1 text-xs bg-surface border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent text-text-primary"
										placeholder="Device name"
										autofocus
									/>
								{:else}
									<button
										onclick={() => isEditingName = true}
										class="text-text-secondary text-xs truncate hover:text-text-primary transition-colors"
										title="Click to rename this device"
									>
										{deviceName || db.publicKey.slice(0, 12) + '...'}
									</button>
									<span class="text-text-muted text-xs flex-shrink-0">(this device)</span>
								{/if}
							</div>
							{#each members as member}
								{#if member.id !== db.publicKey && !member.removedAt}
									<div class="flex items-center gap-2 text-sm">
										<span class="w-2 h-2 rounded-full bg-accent flex-shrink-0"></span>
										<span class="text-text-secondary font-mono text-xs truncate">{member.name || member.id}</span>
									</div>
								{/if}
							{/each}
							{#if members.filter(m => m.id !== db.publicKey && !m.removedAt).length === 0}
								<p class="text-xs text-text-muted">No other devices connected</p>
							{/if}
						</div>
					</div>

					<Button onclick={() => showInviteModal = true} class="w-full">
						Connect Another Device
					</Button>

					<div class="bg-surface-elevated border border-border rounded-lg p-4">
						<h3 class="font-medium text-text-primary mb-2">About Sync</h3>
						<ul class="text-sm text-text-secondary space-y-1">
							<li>Your data is encrypted end-to-end</li>
							<li>Changes sync automatically via Nostr relays</li>
							<li>Copy the invite link to connect another device</li>
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
						bind:value={preferencesStore.weightUnit}
						options={weightUnitOptions}
						label="Weight Unit"
						id="weight-unit"
						hint="Unit for displaying weight values"
						onchange={() => preferencesStore.update({ weightUnit: preferencesStore.weightUnit })}
					/>

					<div class="border-t border-border pt-4">
						<Select
							bind:value={preferencesStore.decimalPlaces}
							options={decimalPlacesOptions}
							label="Decimal Places"
							id="decimal-places"
							hint="Precision for displaying numeric values"
							onchange={() => preferencesStore.update({ decimalPlaces: preferencesStore.decimalPlaces })}
						/>
					</div>
				</div>
			{/snippet}
		</Card>

		<InfoBox type="info" title="Tips">
			<ul class="space-y-1">
				<li>You can manually adjust the timer duration during your workout</li>
				<li>Skip the timer anytime to move to the next set</li>
				<li>Sound and vibration will alert you when rest period ends</li>
				<li>Typical rest periods: 2-3 minutes for compound exercises, 1-2 minutes for isolation</li>
			</ul>
		</InfoBox>

		<Card class="mb-6 mt-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Data Management</h2>

				<div class="space-y-4">
					<div class="flex flex-col sm:flex-row gap-3">
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
						<h3 class="font-medium text-text-primary mb-2">About Import/Export</h3>
						<ul class="text-sm text-text-secondary space-y-1">
							<li>Export creates a backup file with all your workout data</li>
							<li>Import restores data from a previously exported backup</li>
							<li>You can choose how to handle duplicate items during import</li>
							<li>Store backup files in a safe location for data security</li>
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
								<p class="font-medium">Export Complete!</p>
							</div>
							<p class="text-sm text-text-secondary">{exportResult.message}</p>
							<p class="text-sm text-text-muted">File has been downloaded to your default download location.</p>
						</div>
					{:else}
						<div class="space-y-3">
							<div class="flex items-center gap-2 text-danger">
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

		{#if showInviteModal}
			<InviteModal onclose={() => showInviteModal = false} />
		{/if}
	</div>
</div>
