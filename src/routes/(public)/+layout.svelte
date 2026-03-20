<script lang="ts">
	import '../../app.css';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import { db } from '$lib/db';
	import { migrateFromDexieIfNeeded } from '$lib/migrateDexieToTablinum';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import PWAInstallPrompt from '$lib/components/PWAInstallPrompt.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import SwipeHandler from '$lib/components/SwipeHandler.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();

	onMount(async () => {
		// Wait for Tablinum to be ready
		await db.ready;

		// Migrate data from old Dexie database if needed
		await migrateFromDexieIfNeeded(db);

		// Load user preferences
		await preferencesStore.load();
	});

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
<SwipeHandler />
<div class="pb-16 md:pb-0 md:pt-16 w-full min-w-[320px] min-h-screen bg-bg">
	{@render children()}
</div>
<Navigation />
