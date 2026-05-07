<script lang="ts">
	import { Play } from 'lucide-svelte';
	import type { Workout } from '$lib/types';

	interface RoutineCardProps {
		routine: Workout;
		href?: string;
		class?: string;
	}

	let {
		routine,
		href = `/session/new?routine=${routine.id}`,
		class: className = ''
	}: RoutineCardProps = $props();

	const exerciseCount = $derived(routine.exercises?.length ?? 0);
</script>

<a
	{href}
	class="group flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-all duration-200 hover:border-border-active hover:bg-surface-elevated min-w-[180px] {className}"
>
	<div>
		<h3 class="font-display font-semibold text-base text-text-primary line-clamp-2">
			{routine.name}
		</h3>
		<p class="mt-1 text-xs text-text-muted">
			{exerciseCount} exercise{exerciseCount === 1 ? '' : 's'}
		</p>
	</div>
	<span
		class="inline-flex items-center gap-1.5 self-start rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-text-secondary group-hover:text-text-primary transition-colors"
	>
		<Play class="w-3.5 h-3.5" />
		Start
	</span>
</a>
