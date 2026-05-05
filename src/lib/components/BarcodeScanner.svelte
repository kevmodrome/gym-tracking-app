<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { startScanner, type ScanController } from '$lib/nutrition/scanner';

	interface Props {
		onScan: (barcode: string) => void;
		onError?: (e: unknown) => void;
	}

	const { onScan, onError }: Props = $props();

	let video: HTMLVideoElement | null = $state(null);
	let controller: ScanController | null = null;
	let error = $state<string | null>(null);

	onMount(async () => {
		if (!video) return;
		try {
			controller = await startScanner(video, (r) => {
				onScan(r.barcode);
			});
		} catch (e) {
			error = e instanceof Error ? e.message : 'Camera unavailable';
			onError?.(e);
		}
	});

	onDestroy(() => controller?.stop());
</script>

<div class="relative w-full bg-black aspect-[3/4] rounded-lg overflow-hidden">
	<!-- svelte-ignore a11y_media_has_caption -->
	<video bind:this={video} class="w-full h-full object-cover" muted playsinline></video>
	<div class="absolute inset-0 pointer-events-none flex items-center justify-center">
		<div class="w-3/4 h-1/3 border-2 border-accent/80 rounded-lg"></div>
	</div>
	{#if error}
		<div class="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-text-primary">
			{error}
		</div>
	{/if}
</div>
