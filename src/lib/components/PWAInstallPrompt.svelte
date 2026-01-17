<script lang="ts">
	import { onMount } from 'svelte';

	let deferredPrompt = $state<Event | null>(null);
	let showInstallButton = $state(false);

	onMount(() => {
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			deferredPrompt = e;
			showInstallButton = true;
		});

		window.addEventListener('appinstalled', () => {
			showInstallButton = false;
			deferredPrompt = null;
		});
	});

	async function installApp() {
		if (deferredPrompt) {
			// @ts-ignore
			deferredPrompt.prompt();
			// @ts-ignore
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === 'accepted') {
				showInstallButton = false;
			}
			deferredPrompt = null;
		}
	}

	function dismiss() {
		showInstallButton = false;
	}
</script>

{#if showInstallButton}
	<div class="fixed bottom-4 right-4 z-50">
		<div class="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-xs">
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="font-semibold text-gray-900">Install GymTrack</p>
					<p class="text-sm text-gray-600 mt-1">Add this app to your home screen for the best experience</p>
				</div>
				<button
					onclick={dismiss}
					class="text-gray-400 hover:text-gray-600 transition-colors"
					aria-label="Dismiss"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>
			<div class="mt-3 flex gap-2">
				<button
					onclick={installApp}
					class="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
				>
					Install
				</button>
				<button
					onclick={dismiss}
					class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
				>
					Not now
				</button>
			</div>
		</div>
	</div>
{/if}
