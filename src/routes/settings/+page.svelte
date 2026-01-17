<script lang="ts">
	import { onMount } from 'svelte';
	import type { AppSettings } from '$lib/types';
	import XIcon from '$lib/components/XIcon.svelte';

	let settings = $state<AppSettings>({
		defaultRestDuration: 90,
		soundEnabled: true,
		vibrationEnabled: true
	});

	let showSavedMessage = $state(false);
	let messageTimeout: number | null = null;

	onMount(() => {
		loadSettings();
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

	function saveSettings() {
		localStorage.setItem('gym-app-settings', JSON.stringify(settings));

		showSavedMessage = true;
		if (messageTimeout) {
			clearTimeout(messageTimeout);
		}
		messageTimeout = window.setTimeout(() => {
			showSavedMessage = false;
		}, 3000);
	}

	function handleBack() {
		window.location.href = '/';
	}
</script>

<div class="min-h-screen bg-gray-100 p-4 md:p-8">
	<div class="max-w-2xl mx-auto">
		<div class="flex items-center justify-between mb-6">
			<div class="flex items-center gap-4">
				<button
					onclick={handleBack}
					class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
					type="button"
				>
					← Back
				</button>
				<h1 class="text-3xl font-bold text-gray-900">Settings</h1>
			</div>
			<button
				onclick={saveSettings}
				class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
				type="button"
			>
				Save Settings
			</button>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Rest Timer</h2>

			<div class="space-y-4">
				<div>
					<label for="default-rest-duration" class="block text-sm font-medium text-gray-700 mb-1">
						Default Rest Duration (seconds)
					</label>
					<input
						id="default-rest-duration"
						type="number"
						min="10"
						max="300"
						bind:value={settings.defaultRestDuration}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

		<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
			<h3 class="font-semibold text-blue-900 mb-2">Tips</h3>
			<ul class="text-sm text-blue-800 space-y-1">
				<li>• You can manually adjust the timer duration during your workout</li>
				<li>• Skip the timer anytime to move to the next set</li>
				<li>• Sound and vibration will alert you when rest period ends</li>
				<li>• Typical rest periods: 2-3 minutes for compound exercises, 1-2 minutes for isolation</li>
			</ul>
		</div>

		{#if showSavedMessage}
			<div class="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
				<span class="text-xl">✓</span>
				<span>Settings saved!</span>
			</div>
		{/if}
	</div>
</div>
