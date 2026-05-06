<script lang="ts">
	import { Sparkles } from 'lucide-svelte';

	interface PRBadgeProps {
		class?: string;
	}

	let { class: className = '' }: PRBadgeProps = $props();
</script>

<span
	class="inline-flex items-center gap-1 rounded-full border border-pr/40 bg-pr/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-pr {className}"
>
	<Sparkles class="w-3 h-3" />
	<span>PR</span>
</span>
