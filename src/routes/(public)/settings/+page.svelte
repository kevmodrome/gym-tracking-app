<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import type { AppSettings } from '$lib/types';
	import ImportBackupModal from '$lib/components/ImportBackupModal.svelte';
	import InviteModal from '$lib/components/InviteModal.svelte';
	import JoinInviteModal from '$lib/components/JoinInviteModal.svelte';
	import { exportBackupData } from '$lib/backupUtils';
	import { db, leaveDevice, seedDemoData, resetAllData } from '$lib/db';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { Button, Select, Toggle, Card, InfoBox, PageHeader, NumberSpinner } from '$lib/ui';
	import { Pencil, Upload, Download } from 'lucide-svelte';
	import { Modal } from '$lib/ui';

	type SyncMember = {
		readonly [x: string]: unknown;
		readonly id: string;
		readonly name?: string;
		readonly removedAt?: number;
	};

	type PendingDangerAction = 'leave' | 'reset' | null;

	let settings = $state<AppSettings>({
		defaultRestDuration: 90,
		soundEnabled: true,
		vibrationEnabled: true
	});

	let showInviteModal = $state(false);
	let showJoinInviteModal = $state(false);
	let showImportModal = $state(false);
	let showExportProgress = $state(false);
	let exportProgress = $state({ current: 0, total: 0, stage: '' });
	let exportResult = $state<{ success: boolean; message: string } | null>(null);
	let hasLoaded = $state(false);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let showResetModal = $state(false);
	let showLeaveModal = $state(false);
	let resetConfirmText = $state('');
	let leaveConfirmText = $state('');
	let pendingDangerAction = $state<PendingDangerAction>(null);
	let deviceNameInput = $state<HTMLInputElement | null>(null);

	// Sync status from Tablinum
	let syncStatus = $derived(db.syncStatus);
	let pendingCount = $derived(db.pendingCount);
	let relayStatus = $derived(db.relayStatus);
	const membersCol = db.members;
	let members = $state<readonly SyncMember[]>([]);
	let otherMembers = $derived.by(() =>
		members.filter((member) => member.id !== db.publicKey && !member.removedAt)
	);
	let isResetting = $derived(pendingDangerAction === 'reset');
	let isLeaving = $derived(pendingDangerAction === 'leave');
	let isDangerActionPending = $derived(pendingDangerAction !== null);

	$effect(() => {
		membersCol.get().then((data) => {
			members = data as readonly SyncMember[];
		});
	});
	let deviceName = $state('');
	let savedDeviceName = $state('');
	let isEditingName = $state(false);

	// Data counts for sync diagnostics
	let sessionCount = $state(0);
	let exerciseCount = $state(0);
	let workoutCount = $state(0);
	let prCount = $state(0);

	$effect(() => {
		db.collection('sessions').count().then((n: number) => sessionCount = n);
	});
	$effect(() => {
		db.collection('exercises').count().then((n: number) => exerciseCount = n);
	});
	$effect(() => {
		db.collection('workouts').count().then((n: number) => workoutCount = n);
	});
	$effect(() => {
		db.collection('personalRecords').count().then((n: number) => prCount = n);
	});

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

	onMount(async () => {
		loadSettings();
		hasLoaded = true;
		const profile = await db.getProfile();
		deviceName = profile.name ?? '';
		savedDeviceName = deviceName;
	});

	$effect(() => {
		if (!isEditingName) return;
		queueMicrotask(() => deviceNameInput?.focus());
	});

	async function saveDeviceName() {
		isEditingName = false;
		const trimmed = deviceName.trim();
		deviceName = trimmed;
		if (trimmed === savedDeviceName) return;
		savedDeviceName = trimmed;
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

	function openResetModal() {
		showResetModal = true;
		resetConfirmText = '';
	}

	function openLeaveModal() {
		showLeaveModal = true;
		leaveConfirmText = '';
	}

	async function handleReset() {
		pendingDangerAction = 'reset';
		try {
			await resetAllData();
		} catch (e) {
			console.error('Failed to reset app:', e);
			toastStore.showError('Reset failed. Please try again.');
			pendingDangerAction = null;
		}
	}

	async function handleLeave() {
		pendingDangerAction = 'leave';
		try {
			await leaveDevice();
		} catch (e) {
			console.error('Failed to leave sync group:', e);
			toastStore.showError('Leaving sync failed. Please try again.');
			pendingDangerAction = null;
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
						<div class="space-y-1">
							<div class="flex items-center gap-3 min-h-[44px] bg-success/10 border border-success/20 rounded-lg px-3 -mx-1">
								<span class="w-3 h-3 rounded-full bg-success flex-shrink-0"></span>
								{#if isEditingName}
									<input
										bind:this={deviceNameInput}
										type="text"
										bind:value={deviceName}
										onkeydown={(e) => { if (e.key === 'Enter') saveDeviceName(); if (e.key === 'Escape') isEditingName = false; }}
										onblur={saveDeviceName}
										class="flex-1 min-w-0 px-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent text-text-primary placeholder:text-text-muted min-h-[36px]"
										placeholder="Device name"
									/>
								{:else}
									<button
										onclick={() => isEditingName = true}
										class="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 text-sm text-text-secondary bg-surface border border-transparent rounded-lg hover:border-border hover:text-text-primary transition-colors text-left truncate min-h-[36px]"
										title="Click to rename this device"
									>
										<span class="truncate">{deviceName || db.publicKey.slice(0, 12) + '...'}</span>
										<Pencil class="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
									</button>
								{/if}
								<span class="text-success text-xs font-medium flex-shrink-0 whitespace-nowrap">(this device)</span>
							</div>
							{#each otherMembers as member}
								<div class="flex items-center gap-3 min-h-[44px]">
									<span class="w-3 h-3 rounded-full bg-accent flex-shrink-0"></span>
									<span class="text-text-secondary text-sm truncate">{member.name || member.id}</span>
								</div>
							{/each}
							{#if otherMembers.length === 0}
								<p class="text-sm text-text-muted min-h-[44px] flex items-center">No other devices connected</p>
							{/if}
						</div>
					</div>

					<div class="bg-surface-elevated border border-border rounded-lg p-4">
						<h3 class="font-medium text-text-primary mb-2">Data Counts</h3>
						<div class="grid grid-cols-2 gap-2">
							<div class="flex items-center justify-between py-1">
								<span class="text-sm text-text-secondary">Sessions</span>
								<span class="text-sm font-medium text-text-primary">{sessionCount}</span>
							</div>
							<div class="flex items-center justify-between py-1">
								<span class="text-sm text-text-secondary">Exercises</span>
								<span class="text-sm font-medium text-text-primary">{exerciseCount}</span>
							</div>
							<div class="flex items-center justify-between py-1">
								<span class="text-sm text-text-secondary">Workouts</span>
								<span class="text-sm font-medium text-text-primary">{workoutCount}</span>
							</div>
							<div class="flex items-center justify-between py-1">
								<span class="text-sm text-text-secondary">Personal Records</span>
								<span class="text-sm font-medium text-text-primary">{prCount}</span>
							</div>
						</div>
						<p class="text-xs text-text-muted mt-2">Compare these counts across devices to verify sync completeness.</p>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<Button onclick={() => showInviteModal = true} class="w-full">
							Connect Another Device
						</Button>
						<Button
							variant="secondary"
							onclick={() => showJoinInviteModal = true}
							class="w-full"
						>
							Join with Invite Code
						</Button>
					</div>

					<div class="bg-surface-elevated border border-border rounded-lg p-4">
						<h3 class="font-medium text-text-primary mb-2">About Sync</h3>
						<ul class="text-sm text-text-secondary space-y-1">
							<li>Your data is encrypted end-to-end</li>
							<li>Changes sync automatically via Nostr relays</li>
							<li>Share either the invite link or the invite code to connect another device</li>
						</ul>
					</div>
				</div>
			{/snippet}
		</Card>

		<Card class="mb-6">
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Nutrition</h2>
				<p class="text-sm text-text-secondary mb-4">
					Set your body profile, daily protein target, and calorie/macro goals.
				</p>
				<Button href="/settings/profile" variant="secondary">Profile &amp; Targets</Button>
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
							<Upload class="w-5 h-5" />
							<span>Export Data</span>
						</Button>
						<Button variant="success" onclick={showImportBackupModal} class="flex-1">
							<Download class="w-5 h-5" />
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

		<Card class="mb-6 border-danger/50">
			{#snippet children()}
				<h2 class="text-xl font-bold text-danger mb-4">Danger Zone</h2>

				<div class="space-y-4">
					<div class="bg-surface-elevated border border-border rounded-lg p-4 space-y-3">
						<div>
							<h3 class="font-medium text-text-primary">Leave Sync Group</h3>
							<p class="text-sm text-text-secondary mt-1">
								Notify other devices that this device has left, then clear its local synced data and restart the app.
							</p>
						</div>
						<Button variant="secondary" onclick={openLeaveModal} disabled={isDangerActionPending}>
							Leave This Device
						</Button>
					</div>

					<div class="bg-surface-elevated border border-danger/40 rounded-lg p-4 space-y-3">
						<div>
							<h3 class="font-medium text-text-primary">Reset App</h3>
							<p class="text-sm text-text-secondary mt-1">
								Delete local app data and restart fresh without sending a leave event to other devices.
							</p>
						</div>
						<Button variant="danger" onclick={openResetModal} disabled={isDangerActionPending}>
							Reset All Data
						</Button>
					</div>
				</div>
			{/snippet}
		</Card>

		<Modal
			open={showLeaveModal}
			title="Leave Sync Group"
			size="sm"
			onclose={() => showLeaveModal = false}
		>
			{#snippet children()}
				<div class="space-y-4">
					<p class="text-text-secondary">
						This device will publish a leave event so other connected devices stop showing it in their device list. Local synced data on this device will also be cleared.
					</p>
					<p class="text-sm text-danger font-medium">This action cannot be undone.</p>
					<div>
						<label for="leave-confirm" class="block text-sm text-text-secondary mb-2">
							Type <strong class="text-text-primary">LEAVE</strong> to confirm
						</label>
						<input
							id="leave-confirm"
							type="text"
							bind:value={leaveConfirmText}
							placeholder="LEAVE"
							class="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-danger focus:border-danger"
						/>
					</div>
				</div>
			{/snippet}
			{#snippet footer()}
				<Button variant="secondary" onclick={() => showLeaveModal = false} disabled={isDangerActionPending}>
					Cancel
				</Button>
				<Button variant="danger" disabled={leaveConfirmText !== 'LEAVE' || isDangerActionPending} onclick={handleLeave}>
					{isLeaving ? 'Leaving...' : 'Leave Device'}
				</Button>
			{/snippet}
		</Modal>

		<Modal
			open={showResetModal}
			title="Reset All Data"
			size="sm"
			onclose={() => showResetModal = false}
		>
			{#snippet children()}
				<div class="space-y-4">
					<p class="text-text-secondary">
						This will permanently delete <strong class="text-text-primary">all local</strong> workout data, exercises, sessions, and settings on this device. Other devices will not be notified that this device left.
					</p>
					<p class="text-sm text-danger font-medium">This action cannot be undone.</p>
					<div>
						<label for="reset-confirm" class="block text-sm text-text-secondary mb-2">
							Type <strong class="text-text-primary">RESET</strong> to confirm
						</label>
						<input
							id="reset-confirm"
							type="text"
							bind:value={resetConfirmText}
							placeholder="RESET"
							class="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-danger focus:border-danger"
						/>
					</div>
				</div>
			{/snippet}
			{#snippet footer()}
				<Button variant="secondary" onclick={() => showResetModal = false} disabled={isDangerActionPending}>
					Cancel
				</Button>
				<Button variant="danger" disabled={resetConfirmText !== 'RESET' || isDangerActionPending} onclick={handleReset}>
					{isResetting ? 'Resetting...' : 'Delete Everything'}
				</Button>
			{/snippet}
		</Modal>

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

		{#if showJoinInviteModal}
			<JoinInviteModal onclose={() => showJoinInviteModal = false} />
		{/if}
	</div>
</div>
