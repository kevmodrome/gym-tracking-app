<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import ImportBackupModal from '$lib/components/ImportBackupModal.svelte';
	import InviteModal from '$lib/components/InviteModal.svelte';
	import JoinInviteModal from '$lib/components/JoinInviteModal.svelte';
	import { exportBackupData } from '$lib/backupUtils';
	import { db, leaveDevice, seedDemoData, resetAllData } from '$lib/db';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import {
		Button,
		Select,
		Toggle,
		Card,
		Page,
		NumberSpinner,
		ConfirmDialog,
		Modal
	} from '$lib/ui';
	import {
		Pencil,
		Upload,
		Download,
		AlertTriangle,
		Github,
		ExternalLink
	} from 'lucide-svelte';

	type SyncMember = {
		readonly [x: string]: unknown;
		readonly id: string;
		readonly name?: string;
		readonly removedAt?: number;
	};

	type PendingDangerAction = 'leave' | 'reset' | null;

	const APP_VERSION = '0.0.1';

	let showInviteModal = $state(false);
	let showJoinInviteModal = $state(false);
	let showImportModal = $state(false);
	let showExportProgress = $state(false);
	let exportProgress = $state({ current: 0, total: 0, stage: '' });
	let exportResult = $state<{ success: boolean; message: string } | null>(null);
	let showResetModal = $state(false);
	let showLeaveModal = $state(false);
	let resetConfirmText = $state('');
	let leaveConfirmText = $state('');
	let pendingDangerAction = $state<PendingDangerAction>(null);
	let deviceNameInput = $state<HTMLInputElement | null>(null);

	// Sync status (underlying name kept; user-facing copy says "device sync")
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

	onMount(async () => {
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
			toastStore.showSuccess('Demo data loaded.');
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

	const goalOptions = [
		{ value: 'build', label: 'Build muscle' },
		{ value: 'lose', label: 'Lose fat' },
		{ value: 'general', label: 'General fitness' }
	];

	const trackingDepthOptions = [
		{ value: 'basic', label: 'Basic (sets + reps)' },
		{ value: 'standard', label: 'Standard (+ RPE)' },
		{ value: 'full', label: 'Full (+ warmups, notes, PR alerts)' }
	];

	async function updateGoal(value: string) {
		await preferencesStore.update({ goal: value as 'build' | 'lose' | 'general' });
	}

	async function updateTrackingDepth(value: string) {
		await preferencesStore.update({ trackingDepth: value as 'basic' | 'standard' | 'full' });
	}

	async function updateWeightUnit() {
		await preferencesStore.update({ weightUnit: preferencesStore.weightUnit });
	}

	async function updateDefaultRestSeconds(value: number) {
		await preferencesStore.update({ defaultRestSeconds: value });
	}

	async function updateSoundEnabled(value: boolean) {
		await preferencesStore.update({ soundEnabled: value });
	}

	async function updateVibrationEnabled(value: boolean) {
		await preferencesStore.update({ vibrationEnabled: value });
	}

	const isConnected = $derived((relayStatus.connectedUrls?.length ?? 0) > 0);
</script>

<Page title="Settings" maxWidth="3xl">
	{#snippet children()}
		<div class="space-y-6">
		<!-- Profile -->
		<Card>
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Profile</h2>

				<div class="space-y-4">
					<div>
						<label for="device-name" class="block text-sm font-medium text-text-primary mb-2">
							Device name
						</label>
						{#if isEditingName}
							<input
								id="device-name"
								bind:this={deviceNameInput}
								type="text"
								bind:value={deviceName}
								onkeydown={(e) => {
									if (e.key === 'Enter') saveDeviceName();
									if (e.key === 'Escape') isEditingName = false;
								}}
								onblur={saveDeviceName}
								class="w-full px-3 py-2 text-sm bg-surface-elevated border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent text-text-primary placeholder:text-text-muted min-h-[44px]"
								placeholder="My phone"
							/>
						{:else}
							<button
								onclick={() => (isEditingName = true)}
								class="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-text-primary bg-surface-elevated border border-border rounded-lg hover:border-border-active transition-colors text-left min-h-[44px]"
							>
								<span class="truncate">
									{deviceName || db.publicKey.slice(0, 12) + '...'}
								</span>
								<Pencil class="w-4 h-4 flex-shrink-0 opacity-60" />
							</button>
						{/if}
						<p class="mt-2 text-xs text-text-muted">
							Shown to your other devices in device sync.
						</p>
					</div>

					<div class="border-t border-border pt-4">
						<h3 class="text-sm font-medium text-text-primary mb-1">Body & nutrition profile</h3>
						<p class="text-sm text-text-secondary mb-3">
							Body measurements, daily protein target, and calorie/macro goals.
						</p>
						<Button href="/settings/profile" variant="secondary">
							Edit profile & targets
						</Button>
					</div>
				</div>
			{/snippet}
		</Card>

		<!-- Goals -->
		<Card>
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Goals</h2>

				<div class="space-y-4">
					<Select
						value={preferencesStore.goal ?? 'general'}
						options={goalOptions}
						label="Primary goal"
						id="primary-goal"
						hint="Set during onboarding. Adjust at any time."
						onchange={(v) => updateGoal(String(v))}
					/>

					<div class="border-t border-border pt-4">
						<Select
							value={preferencesStore.trackingDepth ?? 'standard'}
							options={trackingDepthOptions}
							label="Tracking depth"
							id="tracking-depth"
							hint="How much detail to capture per set."
							onchange={(v) => updateTrackingDepth(String(v))}
						/>
					</div>
				</div>
			{/snippet}
		</Card>

		<!-- Units -->
		<Card>
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Units</h2>

				<Select
					bind:value={preferencesStore.weightUnit}
					options={weightUnitOptions}
					label="Weight unit"
					id="weight-unit"
					hint="Used everywhere weights are displayed."
					onchange={updateWeightUnit}
				/>
			{/snippet}
		</Card>

		<!-- Workout defaults -->
		<Card>
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Workout defaults</h2>

				<div class="space-y-4">
					<div>
						<NumberSpinner
							value={preferencesStore.defaultRestSeconds ?? 90}
							label="Default rest duration (seconds)"
							id="default-rest-duration"
							min={10}
							max={300}
							step={5}
							size="sm"
							onchange={updateDefaultRestSeconds}
						/>
						<p class="mt-1 text-sm text-text-muted">
							Used automatically when the rest timer starts.
						</p>
					</div>

					<div class="border-t border-border pt-4">
						<Toggle
							checked={preferencesStore.soundEnabled}
							label="Sound notifications"
							description="Play a sound when the rest timer completes."
							onchange={updateSoundEnabled}
						/>
					</div>

					<div class="border-t border-border pt-4">
						<Toggle
							checked={preferencesStore.vibrationEnabled}
							label="Vibration"
							description="Vibrate when the rest timer completes."
							onchange={updateVibrationEnabled}
						/>
					</div>
				</div>
			{/snippet}
		</Card>

		<!-- Data -->
		<Card>
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Data</h2>

				<div class="space-y-4">
					<div class="flex flex-col sm:flex-row gap-3">
						<Button onclick={handleExport} disabled={showExportProgress} class="flex-1">
							<Upload class="w-5 h-5" />
							<span>Export backup</span>
						</Button>
						<Button variant="secondary" onclick={showImportBackupModal} class="flex-1">
							<Download class="w-5 h-5" />
							<span>Import backup</span>
						</Button>
					</div>
					<p class="text-sm text-text-muted">
						Backups include workouts, exercises, sessions, and settings. Store the file somewhere safe.
					</p>

					{#if dev}
						<div class="border-t border-border pt-4">
							<h3 class="font-medium text-text-primary mb-1">Demo data</h3>
							<p class="text-sm text-text-secondary mb-3">
								Load sample workouts and sessions to try the app.
							</p>
							<Button variant="secondary" onclick={handleLoadDemoData}>Load demo data</Button>
						</div>
					{/if}
				</div>
			{/snippet}
		</Card>

		<!-- Sync -->
		<Card>
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">Device sync</h2>

				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-medium text-text-primary">Connection</h3>
							<p class="text-sm text-text-secondary">
								{#if isConnected}
									Connected to {relayStatus.connectedUrls.length} relay{relayStatus.connectedUrls.length > 1 ? 's' : ''}
								{:else}
									Not connected
								{/if}
								{#if syncStatus === 'syncing'}
									&bull; Syncing
								{/if}
								{#if pendingCount > 0}
									&bull; {pendingCount} pending change{pendingCount > 1 ? 's' : ''}
								{/if}
							</p>
						</div>
						<span
							class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full {isConnected
								? 'bg-success/20 text-success'
								: 'bg-text-muted/20 text-text-muted'}"
						>
							<span
								class="w-2 h-2 rounded-full {isConnected ? 'bg-success' : 'bg-text-muted'}"
							></span>
							{isConnected ? 'Connected' : 'Offline'}
						</span>
					</div>

					<div class="border-t border-border pt-4">
						<h3 class="font-medium text-text-primary mb-2">Connected devices</h3>
						<div class="space-y-2">
							<div
								class="flex items-center gap-3 min-h-[44px] bg-success/10 border border-success/20 rounded-lg px-3"
							>
								<span class="w-2.5 h-2.5 rounded-full bg-success flex-shrink-0"></span>
								<span class="flex-1 truncate text-sm text-text-primary">
									{deviceName || db.publicKey.slice(0, 12) + '...'}
								</span>
								<span class="text-success text-xs font-medium flex-shrink-0">This device</span>
							</div>
							{#each otherMembers as member}
								<div class="flex items-center gap-3 min-h-[44px] px-3">
									<span class="w-2.5 h-2.5 rounded-full bg-accent flex-shrink-0"></span>
									<span class="text-sm text-text-secondary truncate">
										{member.name || member.id}
									</span>
								</div>
							{/each}
							{#if otherMembers.length === 0}
								<p class="text-sm text-text-muted px-3 min-h-[44px] flex items-center">
									No other devices connected.
								</p>
							{/if}
						</div>
					</div>

					<div class="border-t border-border pt-4 grid gap-3 sm:grid-cols-2">
						<Button onclick={() => (showInviteModal = true)} class="w-full">
							Invite a device
						</Button>
						<Button
							variant="secondary"
							onclick={() => (showJoinInviteModal = true)}
							class="w-full"
						>
							Join with code
						</Button>
					</div>

					<p class="text-xs text-text-muted">
						Your data is end-to-end encrypted and synced peer-to-peer through public relays.
					</p>
				</div>
			{/snippet}
		</Card>

		<!-- About -->
		<Card>
			{#snippet children()}
				<h2 class="text-xl font-bold text-text-primary mb-4">About</h2>

				<div class="space-y-3">
					<div class="flex items-center justify-between min-h-[44px]">
						<span class="text-sm text-text-secondary">Version</span>
						<span class="text-sm font-medium text-text-primary">{APP_VERSION}</span>
					</div>

					<div class="border-t border-border pt-3">
						<a
							href="https://github.com/kevmodrome/gym-recording-app"
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center justify-between min-h-[44px] text-sm text-text-primary hover:text-accent transition-colors"
						>
							<span class="flex items-center gap-2">
								<Github class="w-4 h-4" />
								GitHub repository
							</span>
							<ExternalLink class="w-4 h-4 opacity-60" />
						</a>
					</div>
				</div>
			{/snippet}
		</Card>

		<!-- Danger zone -->
		<Card class="border-danger/50 bg-danger/5">
			{#snippet children()}
				<div class="flex items-center gap-2 mb-4">
					<AlertTriangle class="w-5 h-5 text-danger" />
					<h2 class="text-xl font-bold text-danger">Danger zone</h2>
				</div>

				<div class="space-y-4">
					<div>
						<h3 class="font-medium text-text-primary">Leave device sync</h3>
						<p class="text-sm text-text-secondary mt-1 mb-3">
							Notify other devices that this one has left, then clear locally synced data and restart the app.
						</p>
						<Button
							variant="secondary"
							onclick={openLeaveModal}
							disabled={isDangerActionPending}
						>
							Leave sync on this device
						</Button>
					</div>

					<div class="border-t border-danger/30 pt-4">
						<h3 class="font-medium text-text-primary">Reset all data</h3>
						<p class="text-sm text-text-secondary mt-1 mb-3">
							Delete local app data and restart fresh. Other devices will not be notified.
						</p>
						<Button
							variant="danger"
							onclick={openResetModal}
							disabled={isDangerActionPending}
						>
							Reset all data
						</Button>
					</div>
				</div>
			{/snippet}
		</Card>

		<!-- Leave confirm -->
		<Modal
			open={showLeaveModal}
			title="Leave device sync"
			size="sm"
			onclose={() => (showLeaveModal = false)}
		>
			{#snippet children()}
				<div class="space-y-4">
					<p class="text-text-secondary">
						This device will publish a leave event so other connected devices stop showing it. Locally synced data on this device will also be cleared.
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
				<Button
					variant="secondary"
					onclick={() => (showLeaveModal = false)}
					disabled={isDangerActionPending}
				>
					Cancel
				</Button>
				<Button
					variant="danger"
					disabled={leaveConfirmText !== 'LEAVE' || isDangerActionPending}
					onclick={handleLeave}
				>
					{isLeaving ? 'Leaving...' : 'Leave device'}
				</Button>
			{/snippet}
		</Modal>

		<!-- Reset confirm -->
		<Modal
			open={showResetModal}
			title="Reset all data"
			size="sm"
			onclose={() => (showResetModal = false)}
		>
			{#snippet children()}
				<div class="space-y-4">
					<p class="text-text-secondary">
						This will permanently delete <strong class="text-text-primary">all local</strong> workout data, exercises, sessions, and settings on this device. Other devices will not be notified.
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
				<Button
					variant="secondary"
					onclick={() => (showResetModal = false)}
					disabled={isDangerActionPending}
				>
					Cancel
				</Button>
				<Button
					variant="danger"
					disabled={resetConfirmText !== 'RESET' || isDangerActionPending}
					onclick={handleReset}
				>
					{isResetting ? 'Resetting...' : 'Delete everything'}
				</Button>
			{/snippet}
		</Modal>

		<!-- Export progress -->
		{#if showExportProgress}
			<div
				class="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-[60]"
				role="presentation"
			>
				<div class="bg-surface border border-border rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-xl font-bold text-text-primary">Exporting backup</h3>
					</div>

					{#if exportResult === null}
						<div class="space-y-4">
							<div class="flex items-center gap-2">
								<div class="flex-1 bg-surface-elevated rounded-full h-2 overflow-hidden">
									<div
										class="bg-accent h-full transition-all duration-300"
										style:width={exportProgress.total > 0
											? `${(exportProgress.current / exportProgress.total) * 100}%`
											: '0%'}
									></div>
								</div>
								<span class="text-sm text-text-secondary font-medium min-w-[3rem]">
									{exportProgress.total > 0
										? `${Math.round((exportProgress.current / exportProgress.total) * 100)}%`
										: '0%'}
								</span>
							</div>
							<p class="text-sm text-text-secondary">{exportProgress.stage}</p>
						</div>
					{:else if exportResult.success}
						<div class="space-y-3">
							<p class="font-medium text-success">Export complete.</p>
							<p class="text-sm text-text-secondary">{exportResult.message}</p>
							<p class="text-sm text-text-muted">
								The file has been downloaded to your default download location.
							</p>
						</div>
					{:else}
						<div class="space-y-3">
							<p class="font-medium text-danger">Export failed</p>
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
			<InviteModal onclose={() => (showInviteModal = false)} />
		{/if}

		{#if showJoinInviteModal}
			<JoinInviteModal onclose={() => (showJoinInviteModal = false)} />
		{/if}
		</div>
	{/snippet}
</Page>
