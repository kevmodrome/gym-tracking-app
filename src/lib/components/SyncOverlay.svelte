<script lang="ts">
	import { isBlockingSync } from '$lib/syncService';
	import { RefreshCw } from 'lucide-svelte';
</script>

{#if $isBlockingSync}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-label="Syncing data"
	>
		<div class="flex flex-col items-center gap-4">
			<RefreshCw class="w-10 h-10 text-accent animate-spin" />
			<p class="text-lg font-medium text-text-primary">Syncing...</p>
		</div>
	</div>
{/if}
