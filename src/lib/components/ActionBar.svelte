<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!--
  Mobile: fixed above bottom nav. Desktop: inline flow.
  Single render of children avoids duplication.
-->
<div class="fixed bottom-20 left-0 right-0 bg-surface border-t border-border p-4 z-40 md:static md:border-t-0 md:pb-6">
	<div class="max-w-md mx-auto space-y-3">
		{@render children()}
	</div>
</div>
