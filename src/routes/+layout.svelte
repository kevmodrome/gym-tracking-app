<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import PWAInstallPrompt from '$lib/components/PWAInstallPrompt.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import SwipeHandler from '$lib/components/SwipeHandler.svelte';
	import SyncIndicator from '$lib/components/SyncIndicator.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" sizes="180x180" href="/icon-512x512.svg" />
	<link rel="apple-touch-icon" sizes="152x152" href="/icon-512x512.svg" />
	<link rel="apple-touch-icon" sizes="120x120" href="/icon-192x192.svg" />
	<link rel="apple-touch-icon" sizes="76x76" href="/icon-192x192.svg" />
	<link rel="apple-touch-icon" sizes="60x60" href="/icon-192x192.svg" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="GymTrack" />
	<meta name="mobile-web-app-capable" content="yes" />
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<Toast />
<SyncIndicator />
<PWAInstallPrompt />
<SwipeHandler />
<div class="pb-16 md:pb-0 w-full min-w-[320px]">
	{@render children()}
</div>
<Navigation />
