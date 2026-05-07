<script lang="ts">
	import '../../app.css';
	import { onMount } from 'svelte';
	import { onNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import PWAInstallPrompt from '$lib/components/PWAInstallPrompt.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import { db } from '$lib/db';

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

	// First-launch onboarding redirect (client only)
	onMount(async () => {
		try {
			const path = page.url.pathname;
			if (path === '/onboarding') return;

			await preferencesStore.load();
			if (preferencesStore.onboardingComplete) return;

			// If user already has sessions, treat as existing user — skip onboarding
			const sessions = await db.collection('sessions').get();
			if (Array.isArray(sessions) && sessions.length > 0) return;

			goto('/onboarding');
		} catch {
			// If anything fails, don't block the app
		}
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
<div
	class="w-full min-w-[320px] min-h-screen bg-bg"
	class:pb-16={page.url.pathname !== '/onboarding'}
	class:md:pb-0={page.url.pathname !== '/onboarding'}
	class:md:pt-16={page.url.pathname !== '/onboarding'}
>
	{@render children()}
</div>
{#if page.url.pathname !== '/onboarding'}
	<Navigation />
{/if}
