<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Lock, CameraOff } from 'lucide-svelte';
	import { ScannerError, startScanner, type ScanController } from '$lib/nutrition/scanner';

	interface Props {
		onScan: (barcode: string) => void;
		onError?: (e: unknown) => void;
	}

	const { onScan, onError }: Props = $props();

	let video: HTMLVideoElement | null = $state(null);
	let controller: ScanController | null = null;
	let error = $state<{ message: string; reason: ScannerError['reason'] | 'unknown' } | null>(null);

	onMount(async () => {
		if (!video) return;
		try {
			controller = await startScanner(video, (r) => {
				onScan(r.barcode);
			});
		} catch (e) {
			if (e instanceof ScannerError) {
				error = { message: e.message, reason: e.reason };
			} else {
				error = {
					message: e instanceof Error ? e.message : 'Camera unavailable',
					reason: 'unknown',
				};
			}
			onError?.(e);
		}
	});

	onDestroy(() => controller?.stop());

	const origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
</script>

<div class="relative w-full bg-black aspect-[3/4] rounded-lg overflow-hidden">
	<!-- svelte-ignore a11y_media_has_caption -->
	<video bind:this={video} class="w-full h-full object-cover" muted playsinline></video>
	<div class="absolute inset-0 pointer-events-none flex items-center justify-center">
		<div class="w-3/4 h-1/3 border-2 border-accent/80 rounded-lg"></div>
	</div>

	{#if error}
		<div class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-6 text-center text-text-primary">
			{#if error.reason === 'insecure-context'}
				<Lock class="w-8 h-8 text-warning" />
				<p class="text-sm font-medium">Camera needs HTTPS</p>
				<p class="text-xs text-text-secondary leading-relaxed">
					Browsers only expose the camera over a secure connection. You're on
					<code class="px-1 py-0.5 rounded bg-surface text-text-primary">{origin}</code>
					— open the deployed app instead, or run the dev server over HTTPS.
				</p>
			{:else if error.reason === 'permission'}
				<CameraOff class="w-8 h-8 text-warning" />
				<p class="text-sm font-medium">Camera permission denied</p>
				<p class="text-xs text-text-secondary leading-relaxed">
					Enable camera access in your browser's site settings, then reload.
				</p>
			{:else}
				<CameraOff class="w-8 h-8 text-warning" />
				<p class="text-sm">{error.message}</p>
			{/if}
		</div>
	{/if}
</div>
