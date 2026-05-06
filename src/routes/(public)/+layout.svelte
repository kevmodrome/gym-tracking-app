<script lang="ts">
	import '../../app.css';
	import { onNavigate } from '$app/navigation';
	import { Settings } from 'lucide-svelte';
	import favicon from '$lib/assets/favicon.svg';
	import PWAInstallPrompt from '$lib/components/PWAInstallPrompt.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();

	// Enable CSS View Transitions for page navigation
	onNavigate((navigation) => {
		// Skip if browser doesn't support view transitions
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" sizes="180x180" href="/icon-180x180.png" />
	<link rel="apple-touch-icon" sizes="152x152" href="/icon-152x152.png" />
	<link rel="apple-touch-icon" sizes="120x120" href="/icon-120x120.png" />
	<link rel="apple-touch-icon" sizes="76x76" href="/icon-76x76.png" />
	<link rel="apple-touch-icon" sizes="60x60" href="/icon-60x60.png" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="GymTrack" />
	<meta name="mobile-web-app-capable" content="yes" />
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<Toast />
<PWAInstallPrompt />
<a
	href="/settings"
	aria-label="Settings"
	class="settings-fab md:hidden flex items-center justify-center bg-surface border border-border text-text-muted hover:text-text-primary rounded-full transition-colors duration-200"
>
	<Settings class="w-5 h-5" strokeWidth={2} />
</a>
<div class="pb-16 md:pb-0 md:pt-16 w-full min-w-[320px] min-h-screen bg-bg">
	{@render children()}
</div>
<Navigation />

<style>
	.settings-fab {
		position: fixed;
		top: calc(env(safe-area-inset-top, 0px) + 0.75rem);
		right: 0.75rem;
		z-index: 30;
		width: 44px;
		height: 44px;
	}
</style>
