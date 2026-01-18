<script lang="ts">
	import {
		validateBackupData,
		detectDuplicates,
		importBackupData,
		type BackupData,
		type DuplicateResolution,
		type ImportResult
	} from '$lib/backupUtils';
	import { Button, Modal, Select, InfoBox } from '$lib/ui';

	let fileInput = $state<HTMLInputElement>();
	let errorMessage = $state('');
	let isParsing = $state(false);
	let isDetecting = $state(false);
	let isImporting = $state(false);
	let importProgress = $state(0);
	let isCancelling = $state(false);
	let showCancelConfirm = $state(false);

	let backupData = $state<BackupData | null>(null);
	let duplicates = $state<{
		exercises: string[];
		workouts: string[];
		sessions: string[];
		personalRecords: string[];
	} | null>(null);

	let resolution = $state<DuplicateResolution>({
		exercises: 'skip',
		workouts: 'skip',
		sessions: 'skip',
		personalRecords: 'skip'
	});

	let importResult = $state<ImportResult | null>(null);

	let { onClose } = $props<{ onClose: () => void }>();

	let abortController = $state<AbortController | null>(null);

	const resolutionOptions = [
		{ value: 'skip', label: 'Skip duplicates' },
		{ value: 'replace', label: 'Replace duplicates' },
		{ value: 'merge', label: 'Merge duplicates (merge if newer)' }
	];

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		errorMessage = '';
		isParsing = true;
		importResult = null;
		backupData = null;
		duplicates = null;

		try {
			const text = await file.text();
			const data = JSON.parse(text);

			const validated = await validateBackupData(data);
			if (!validated) {
				errorMessage =
					'Invalid backup file format. The file must contain exercises, workouts, sessions, and personalRecords.';
				return;
			}

			backupData = validated;
			isParsing = false;
			isDetecting = true;

			duplicates = await detectDuplicates(backupData);
			isDetecting = false;
		} catch (error) {
			errorMessage = 'Failed to parse file. Please ensure it is a valid JSON file.';
			isParsing = false;
		}
	}

	async function startImport() {
		if (!backupData) return;

		isImporting = true;
		importProgress = 0;
		abortController = new AbortController();

		try {
			importResult = await importBackupData(backupData, resolution, abortController.signal);
			importProgress = 100;
		} catch (error) {
			if (error instanceof Error && error.message === 'Import cancelled by user') {
				importResult = null;
			} else {
				importResult = {
					success: false,
					totalItems: 0,
					importedItems: 0,
					skippedItems: 0,
					replacedItems: 0,
					errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
					duplicates: { exercises: [], workouts: [], sessions: [], personalRecords: [] }
				};
			}
		}

		isImporting = false;
		abortController = null;
		showCancelConfirm = false;
	}

	async function handleCancel() {
		if (!showCancelConfirm) {
			showCancelConfirm = true;
			return;
		}

		isCancelling = true;
		abortController?.abort();
		showCancelConfirm = false;
		isCancelling = false;
	}

	function reset() {
		errorMessage = '';
		backupData = null;
		duplicates = null;
		importResult = null;
		importProgress = 0;
		if (fileInput) {
			fileInput.value = '';
		}
	}

	function anyDuplicates() {
		if (!duplicates) return false;
		return (
			duplicates.exercises.length > 0 ||
			duplicates.workouts.length > 0 ||
			duplicates.sessions.length > 0 ||
			duplicates.personalRecords.length > 0
		);
	}

	function totalDuplicates() {
		if (!duplicates) return 0;
		return (
			duplicates.exercises.length +
			duplicates.workouts.length +
			duplicates.sessions.length +
			duplicates.personalRecords.length
		);
	}

	function handleClose() {
		reset();
		onClose();
	}
</script>

<Modal open={true} title="Import Backup Data" size="lg" onclose={handleClose}>
	{#snippet children()}
		{#if errorMessage}
			<InfoBox type="error" class="mb-6">
				<div class="flex items-center gap-2">
					<span class="text-xl">⚠️</span>
					<p class="font-medium">Error</p>
				</div>
				<p class="mt-2">{errorMessage}</p>
			</InfoBox>
		{/if}

		{#if !backupData}
			<div class="space-y-4">
				<div>
					<label for="backup-file" class="block text-sm font-medium text-text-secondary mb-2">
						Select Backup File (JSON)
					</label>
					<p class="text-sm text-text-muted mb-3">
						Choose a JSON backup file previously exported from this app.
					</p>
					<input
						id="backup-file"
						bind:this={fileInput}
						type="file"
						accept=".json,application/json"
						onchange={handleFileSelect}
						disabled={isParsing || isImporting}
						class="w-full px-4 py-2 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary disabled:opacity-50 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent file:text-bg file:font-medium"
					/>
				</div>

				{#if isParsing || isDetecting}
					<InfoBox type="info">
						<div class="flex items-center gap-3">
							<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-secondary"></div>
							<p>
								{isParsing ? 'Parsing file...' : 'Detecting duplicates...'}
							</p>
						</div>
					</InfoBox>
				{/if}
			</div>
		{:else if !importResult}
			<div class="space-y-6">
				<InfoBox type="success">
					<div class="flex items-center gap-2">
						<span class="text-xl">✅</span>
						<p class="font-medium">File Validated Successfully</p>
					</div>
					<p class="mt-2 text-sm">
						Version: {backupData.version} | Exported:{' '}
						{new Date(backupData.exportedAt).toLocaleString()}
					</p>
				</InfoBox>

				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div class="bg-surface-elevated border border-border rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-text-primary">{backupData.exercises.length}</div>
						<div class="text-sm text-text-secondary">Exercises</div>
					</div>
					<div class="bg-surface-elevated border border-border rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-text-primary">{backupData.workouts.length}</div>
						<div class="text-sm text-text-secondary">Workouts</div>
					</div>
					<div class="bg-surface-elevated border border-border rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-text-primary">{backupData.sessions.length}</div>
						<div class="text-sm text-text-secondary">Sessions</div>
					</div>
					<div class="bg-surface-elevated border border-border rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-text-primary">{backupData.personalRecords.length}</div>
						<div class="text-sm text-text-secondary">Personal Records</div>
					</div>
				</div>

				{#if anyDuplicates()}
					<InfoBox type="warning">
						<div class="flex items-center gap-2 mb-4">
							<span class="text-xl">⚠️</span>
							<p class="font-medium">{totalDuplicates()} duplicate(s) detected in your database</p>
						</div>

						<div class="space-y-4">
							{#if duplicates?.exercises.length}
								<div>
									<Select
										label="Exercises ({duplicates.exercises.length})"
										bind:value={resolution.exercises}
										options={resolutionOptions}
									/>
									<div class="mt-2 text-xs text-text-muted">
										{duplicates.exercises.slice(0, 3).join(', ')}
										{duplicates.exercises.length > 3 ? ` +${duplicates.exercises.length - 3} more...` : ''}
									</div>
								</div>
							{/if}

							{#if duplicates?.workouts.length}
								<div>
									<Select
										label="Workouts ({duplicates.workouts.length})"
										bind:value={resolution.workouts}
										options={resolutionOptions}
									/>
									<div class="mt-2 text-xs text-text-muted">
										{duplicates.workouts.slice(0, 3).join(', ')}
										{duplicates.workouts.length > 3 ? ` +${duplicates.workouts.length - 3} more...` : ''}
									</div>
								</div>
							{/if}

							{#if duplicates?.sessions.length}
								<div>
									<Select
										label="Sessions ({duplicates.sessions.length})"
										bind:value={resolution.sessions}
										options={resolutionOptions}
									/>
									<div class="mt-2 text-xs text-text-muted">
										{duplicates.sessions.slice(0, 3).join(', ')}
										{duplicates.sessions.length > 3 ? ` +${duplicates.sessions.length - 3} more...` : ''}
									</div>
								</div>
							{/if}

							{#if duplicates?.personalRecords.length}
								<div>
									<Select
										label="Personal Records ({duplicates.personalRecords.length})"
										bind:value={resolution.personalRecords}
										options={[
											{ value: 'skip', label: 'Skip duplicates' },
											{ value: 'replace', label: 'Replace duplicates' },
											{ value: 'merge', label: 'Merge duplicates (keep most recent)' }
										]}
									/>
									<div class="mt-2 text-xs text-text-muted">
										{duplicates.personalRecords.slice(0, 3).join(', ')}
										{duplicates.personalRecords.length > 3 ? ` +${duplicates.personalRecords.length - 3} more...` : ''}
									</div>
								</div>
							{/if}
						</div>
					</InfoBox>
				{:else}
					<InfoBox type="success">
						<div class="flex items-center gap-2">
							<span class="text-xl">✨</span>
							<p class="font-medium">No duplicates found</p>
						</div>
						<p class="mt-2 text-sm">
							All items from this backup will be imported as new items.
						</p>
					</InfoBox>
				{/if}
			</div>
		{:else}
			{#if importResult.success}
				<InfoBox type="success">
					<div class="flex items-center gap-3 mb-4">
						<span class="text-3xl">✅</span>
						<div>
							<p class="text-lg font-bold">Import Completed Successfully!</p>
							<p class="text-sm">All data has been imported.</p>
						</div>
					</div>

					<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
						<div class="bg-success/10 border border-success/30 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-success">{importResult.importedItems}</div>
							<div class="text-sm text-text-secondary">Imported</div>
						</div>
						<div class="bg-warning/10 border border-warning/30 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-warning">{importResult.skippedItems}</div>
							<div class="text-sm text-text-secondary">Skipped</div>
						</div>
						<div class="bg-secondary/10 border border-secondary/30 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-secondary">{importResult.replacedItems}</div>
							<div class="text-sm text-text-secondary">Replaced</div>
						</div>
						<div class="bg-surface-elevated border border-border rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-text-primary">{importResult.totalItems}</div>
							<div class="text-sm text-text-secondary">Total Items</div>
						</div>
					</div>
				</InfoBox>
			{:else}
				<InfoBox type="error">
					<div class="flex items-center gap-3 mb-4">
						<span class="text-3xl">❌</span>
						<div>
							<p class="text-lg font-bold">Import Failed</p>
							<p class="text-sm">An error occurred during import.</p>
						</div>
					</div>

					{#if importResult.errors.length > 0}
						<div class="mt-4 space-y-2">
							{#each importResult.errors as error}
								<div class="bg-danger/10 border border-danger/30 rounded-lg p-3">
									<p class="text-sm text-text-primary">{error}</p>
								</div>
							{/each}
						</div>
					{/if}
				</InfoBox>
			{/if}
		{/if}

		{#if isImporting}
			<div class="mt-6">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium text-text-secondary">Importing...</span>
					<span class="text-sm font-medium text-text-primary">{importProgress}%</span>
				</div>
				<div class="w-full bg-surface-elevated rounded-full h-2">
					<div
						class="bg-accent h-2 rounded-full transition-all duration-300"
						style="width: {importProgress}%"
					></div>
				</div>

				{#if !showCancelConfirm}
					<Button
						variant="danger"
						onclick={handleCancel}
						disabled={isCancelling}
						fullWidth
						class="mt-4"
					>
						{isCancelling ? 'Cancelling...' : 'Cancel Import'}
					</Button>
				{:else}
					<div class="mt-4 flex gap-2">
						<Button variant="secondary" onclick={() => (showCancelConfirm = false)} fullWidth>
							Continue Import
						</Button>
						<Button variant="danger" onclick={handleCancel} disabled={isCancelling} fullWidth>
							{isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
						</Button>
					</div>
				{/if}
			</div>
		{/if}
	{/snippet}
	{#snippet footer()}
		{#if backupData && !importResult && !isImporting}
			<Button variant="primary" onclick={startImport} disabled={isImporting}>
				Start Import
			</Button>
		{/if}

		{#if (importResult || errorMessage) && !isImporting}
			<Button variant="secondary" onclick={reset} disabled={isImporting}>
				Import Another File
			</Button>
		{/if}
	{/snippet}
</Modal>
