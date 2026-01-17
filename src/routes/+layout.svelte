<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import PWAInstallPrompt from '$lib/components/PWAInstallPrompt.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<PWAInstallPrompt />
{@render children()}
