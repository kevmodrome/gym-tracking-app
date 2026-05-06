<script lang="ts">
	import { Flame } from '$lib/icons';

	interface StreakBadgeProps {
		days: number;
		class?: string;
	}

	let { days, class: className = '' }: StreakBadgeProps = $props();
</script>

{#if days > 0}
	<div
		class="inline-flex items-center gap-2 rounded-full border border-streak/30 bg-streak/10 px-3 py-1.5 text-streak {className}"
	>
		<Flame size={16} class="shrink-0" />
		<span class="font-display font-semibold text-sm whitespace-nowrap">
			{days} day{days === 1 ? '' : 's'}
		</span>
	</div>
{/if}
