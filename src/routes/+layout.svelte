<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import PWAInstallPrompt from '$lib/components/PWAInstallPrompt.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import SwipeHandler from '$lib/components/SwipeHandler.svelte';
	import SyncIndicator from '$lib/components/SyncIndicator.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();
</script>>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Toast />
<SyncIndicator />
<PWAInstallPrompt />
<SwipeHandler />
<div class="pb-16 md:pb-0 w-full min-w-[320px]">
	{@render children()}
</div>
<Navigation />
