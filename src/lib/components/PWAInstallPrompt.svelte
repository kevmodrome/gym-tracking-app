<script lang="ts">
	import { onMount } from 'svelte';

	let deferredPrompt = $state<Event | null>(null);
	let showInstallButton = $state(false);
	let isIOS = $state(false);
	let showIOSInstructions = $state(false);

	onMount(() => {
		isIOS = checkIOS();

		window.addEventListener('beforeinstallprompt', (e) => {
			if (isIOS) return;
			e.preventDefault();
			deferredPrompt = e;
			showInstallButton = true;
		});

		window.addEventListener('appinstalled', () => {
			showInstallButton = false;
			showIOSInstructions = false;
			deferredPrompt = null;
		});

		if (isIOS) {
			const dismissed = localStorage.getItem('pwa-install-dismissed');
			if (!dismissed) {
				setTimeout(() => {
					showInstallButton = true;
					showIOSInstructions = true;
				}, 3000);
			}
		}
	});

	function checkIOS(): boolean {
		const ua = window.navigator.userAgent;
		return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
	}

	async function installApp() {
		if (deferredPrompt && !isIOS) {
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
		showIOSInstructions = false;
		if (isIOS) {
			localStorage.setItem('pwa-install-dismissed', 'true');
		}
	}
</script>

{#if showInstallButton}
	<div class="fixed bottom-4 right-4 z-50 left-4 md:left-auto">
		<div class="bg-surface rounded-xl shadow-lg border border-border p-4 max-w-xs">
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="font-semibold text-text-primary">Install GymTrack</p>
					<p class="text-sm text-text-secondary mt-1">Add this app to your home screen for the best experience</p>
				</div>
				<button
					onclick={dismiss}
					class="text-text-muted hover:text-text-primary transition-colors"
					aria-label="Dismiss"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>

			{#if showIOSInstructions}
				<div class="mt-3 bg-surface-elevated rounded-lg p-3 text-sm text-text-secondary">
					<ol class="space-y-2 list-decimal list-inside">
						<li>Tap the Share button <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline mx-1 text-text-muted" viewBox="0 0 20 20" fill="currentColor">
							<path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
						</svg></li>
						<li>Scroll down and tap "Add to Home Screen"</li>
						<li>Tap "Add" to install</li>
					</ol>
				</div>
				<div class="mt-3 flex gap-2">
					<button
						onclick={dismiss}
						class="flex-1 bg-surface-elevated hover:bg-border text-text-secondary font-medium py-2 px-4 rounded-lg transition-colors"
					>
						Dismiss
					</button>
				</div>
			{:else}
				<div class="mt-3 flex gap-2">
					<button
						onclick={installApp}
						class="flex-1 bg-accent hover:bg-accent-muted hover:shadow-[0_0_20px_rgba(197,255,0,0.3)] text-bg font-medium py-2 px-4 rounded-lg transition-all"
					>
						Install
					</button>
					<button
						onclick={dismiss}
						class="flex-1 bg-surface-elevated hover:bg-border text-text-secondary font-medium py-2 px-4 rounded-lg transition-colors"
					>
						Not now
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
