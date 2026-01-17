<script lang="ts">
	import XIcon from '$lib/components/XIcon.svelte';
	import {
		validateBackupData,
		detectDuplicates,
		importBackupData,
		type BackupData,
		type DuplicateResolution,
		type ImportResult
	} from '$lib/backupUtils';

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
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
	<div class="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
		<div class="flex items-center justify-between p-6 border-b">
			<h2 class="text-2xl font-bold text-gray-900">Import Backup Data</h2>
			<button
				onclick={() => {
					reset();
					onClose();
				}}
				class="text-gray-400 hover:text-gray-600 transition-colors"
				type="button"
			>
				<XIcon class="w-6 h-6" />
			</button>
		</div>

		<div class="p-6">
			{#if errorMessage}
				<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
					<div class="flex items-center gap-2 text-red-800">
						<span class="text-xl">⚠️</span>
						<p class="font-medium">Error</p>
					</div>
					<p class="text-red-700 mt-2">{errorMessage}</p>
				</div>
			{/if}

			{#if !backupData}
				<div class="space-y-4">
				<div>
					<label for="backup-file" class="block text-sm font-medium text-gray-700 mb-2">
						Select Backup File (JSON)
					</label>
					<p class="text-sm text-gray-500 mb-3">
						Choose a JSON backup file previously exported from this app.
					</p>
					<input
						id="backup-file"
						bind:this={fileInput}
						type="file"
						accept=".json,application/json"
						onchange={handleFileSelect}
						disabled={isParsing || isImporting}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
					/>
				</div>

					{#if isParsing || isDetecting}
						<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
							<div class="flex items-center gap-3">
								<div
									class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
								></div>
								<p class="text-blue-800">
									{isParsing ? 'Parsing file...' : 'Detecting duplicates...'}
								</p>
							</div>
						</div>
					{/if}
				</div>
			{:else if !importResult}
				<div class="space-y-6">
					<div class="bg-green-50 border border-green-200 rounded-lg p-4">
						<div class="flex items-center gap-2 text-green-800">
							<span class="text-xl">✅</span>
							<p class="font-medium">File Validated Successfully</p>
						</div>
						<p class="text-green-700 mt-2 text-sm">
							Version: {backupData.version} | Exported:{' '}
							{new Date(backupData.exportedAt).toLocaleString()}
						</p>
					</div>

					<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-gray-900">
								{backupData.exercises.length}
							</div>
							<div class="text-sm text-gray-600">Exercises</div>
						</div>
						<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-gray-900">
								{backupData.workouts.length}
							</div>
							<div class="text-sm text-gray-600">Workouts</div>
						</div>
						<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-gray-900">
								{backupData.sessions.length}
							</div>
							<div class="text-sm text-gray-600">Sessions</div>
						</div>
						<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-gray-900">
								{backupData.personalRecords.length}
							</div>
							<div class="text-sm text-gray-600">Personal Records</div>
						</div>
					</div>

					{#if anyDuplicates()}
						<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
							<div class="flex items-center gap-2 text-yellow-800 mb-4">
								<span class="text-xl">⚠️</span>
								<p class="font-medium">
									{totalDuplicates()} duplicate(s) detected in your database
								</p>
							</div>

							<div class="space-y-4">
								{#if duplicates?.exercises.length}
									<div>
										<label for="resolution-exercises" class="block text-sm font-medium text-gray-700 mb-2">
											Exercises ({duplicates.exercises.length})
										</label>
										<select
											id="resolution-exercises"
											bind:value={resolution.exercises}
											class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
										>
											<option value="skip">Skip duplicates</option>
											<option value="replace">Replace duplicates</option>
											<option value="merge">Merge duplicates (merge if newer)</option>
										</select>
										<div class="mt-2 text-xs text-gray-500">
											{duplicates.exercises.slice(0, 3).join(', ')}
											{duplicates.exercises.length > 3 ? ` +${duplicates.exercises.length - 3} more...` : ''}
										</div>
									</div>
								{/if}

								{#if duplicates?.workouts.length}
									<div>
										<label for="resolution-workouts" class="block text-sm font-medium text-gray-700 mb-2">
											Workouts ({duplicates.workouts.length})
										</label>
										<select
											id="resolution-workouts"
											bind:value={resolution.workouts}
											class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
										>
											<option value="skip">Skip duplicates</option>
											<option value="replace">Replace duplicates</option>
											<option value="merge">Merge duplicates (merge if newer)</option>
										</select>
										<div class="mt-2 text-xs text-gray-500">
											{duplicates.workouts.slice(0, 3).join(', ')}
											{duplicates.workouts.length > 3 ? ` +${duplicates.workouts.length - 3} more...` : ''}
										</div>
									</div>
								{/if}

								{#if duplicates?.sessions.length}
									<div>
										<label for="resolution-sessions" class="block text-sm font-medium text-gray-700 mb-2">
											Sessions ({duplicates.sessions.length})
										</label>
										<select
											id="resolution-sessions"
											bind:value={resolution.sessions}
											class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
										>
											<option value="skip">Skip duplicates</option>
											<option value="replace">Replace duplicates</option>
											<option value="merge">Merge duplicates (merge if newer)</option>
										</select>
										<div class="mt-2 text-xs text-gray-500">
											{duplicates.sessions.slice(0, 3).join(', ')}
											{duplicates.sessions.length > 3 ? ` +${duplicates.sessions.length - 3} more...` : ''}
										</div>
									</div>
								{/if}

								{#if duplicates?.personalRecords.length}
									<div>
										<label for="resolution-personal-records" class="block text-sm font-medium text-gray-700 mb-2">
											Personal Records ({duplicates.personalRecords.length})
										</label>
										<select
											id="resolution-personal-records"
											bind:value={resolution.personalRecords}
											class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
										>
											<option value="skip">Skip duplicates</option>
											<option value="replace">Replace duplicates</option>
											<option value="merge">Merge duplicates (keep most recent)</option>
										</select>
										<div class="mt-2 text-xs text-gray-500">
											{duplicates.personalRecords.slice(0, 3).join(', ')}
											{duplicates.personalRecords.length > 3 ? ` +${duplicates.personalRecords.length - 3} more...` : ''}
										</div>
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<div class="bg-green-50 border border-green-200 rounded-lg p-4">
							<div class="flex items-center gap-2 text-green-800">
								<span class="text-xl">✨</span>
								<p class="font-medium">No duplicates found</p>
							</div>
							<p class="text-green-700 mt-2 text-sm">
								All items from this backup will be imported as new items.
							</p>
						</div>
					{/if}
				</div>
			{:else}
				{#if importResult.success}
					<div class="bg-green-50 border border-green-200 rounded-lg p-6">
						<div class="flex items-center gap-3 mb-4">
							<span class="text-3xl">✅</span>
							<div>
								<p class="text-lg font-bold text-green-900">Import Completed Successfully!</p>
								<p class="text-sm text-green-700">All data has been imported.</p>
							</div>
						</div>

						<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
							<div class="bg-white border border-green-200 rounded-lg p-4 text-center">
								<div class="text-2xl font-bold text-green-600">
									{importResult.importedItems}
								</div>
								<div class="text-sm text-gray-600">Imported</div>
							</div>
							<div class="bg-white border border-yellow-200 rounded-lg p-4 text-center">
								<div class="text-2xl font-bold text-yellow-600">
									{importResult.skippedItems}
								</div>
								<div class="text-sm text-gray-600">Skipped</div>
							</div>
							<div class="bg-white border border-blue-200 rounded-lg p-4 text-center">
								<div class="text-2xl font-bold text-blue-600">
									{importResult.replacedItems}
								</div>
								<div class="text-sm text-gray-600">Replaced</div>
							</div>
							<div class="bg-white border border-gray-200 rounded-lg p-4 text-center">
								<div class="text-2xl font-bold text-gray-600">
									{importResult.totalItems}
								</div>
								<div class="text-sm text-gray-600">Total Items</div>
							</div>
						</div>
					</div>
				{:else}
					<div class="bg-red-50 border border-red-200 rounded-lg p-6">
						<div class="flex items-center gap-3 mb-4">
							<span class="text-3xl">❌</span>
							<div>
								<p class="text-lg font-bold text-red-900">Import Failed</p>
								<p class="text-sm text-red-700">An error occurred during import.</p>
							</div>
						</div>

						{#if importResult.errors.length > 0}
							<div class="mt-4 space-y-2">
								{#each importResult.errors as error}
									<div class="bg-red-100 border border-red-300 rounded-lg p-3">
										<p class="text-sm text-red-800">{error}</p>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/if}

			{#if isImporting}
				<div class="mt-6">
					<div class="flex items-center justify-between mb-2">
						<span class="text-sm font-medium text-gray-700">Importing...</span>
						<span class="text-sm font-medium text-gray-700">{importProgress}%</span>
					</div>
					<div class="w-full bg-gray-200 rounded-full h-2">
						<div
							class="bg-indigo-600 h-2 rounded-full transition-all duration-300"
							style="width: {importProgress}%"
						></div>
					</div>

					{#if !showCancelConfirm}
						<button
							onclick={handleCancel}
							disabled={isCancelling}
							type="button"
							class="mt-4 w-full px-4 py-2 border border-red-300 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isCancelling ? 'Cancelling...' : 'Cancel Import'}
						</button>
					{:else}
						<div class="mt-4 flex gap-2">
							<button
								onclick={() => (showCancelConfirm = false)}
								type="button"
								class="flex-1 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
							>
								Continue Import
							</button>
							<button
								onclick={handleCancel}
								disabled={isCancelling}
								type="button"
								class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
							</button>
						</div>
					{/if}
				</div>
			{:else}
				<div class="mt-6 flex gap-3">
					{#if backupData && !importResult}
						<button
							onclick={startImport}
							disabled={isImporting}
							type="button"
							class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
						>
							Start Import
						</button>
					{/if}

					{#if importResult || errorMessage}
						<button
							onclick={reset}
							disabled={isImporting}
							type="button"
							class="flex-1 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
						>
							Import Another File
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
