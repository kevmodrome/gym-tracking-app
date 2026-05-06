<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { addDays, formatDateLabel, todayString } from '$lib/nutrition/dates';

	interface Props {
		date: string;
		onChange: (date: string) => void;
	}

	const { date, onChange }: Props = $props();

	function prev() { onChange(addDays(date, -1)); }
	function next() { onChange(addDays(date, 1)); }
	function today() { onChange(todayString()); }
</script>

<div class="flex items-center justify-between gap-2">
	<button
		type="button"
		onclick={prev}
		class="p-2 rounded-lg hover:bg-surface-hover transition"
		aria-label="Previous day"
	>
		<ChevronLeft class="w-5 h-5" />
	</button>
	<button
		type="button"
		onclick={today}
		class="text-sm font-medium text-text-primary px-3 py-1 rounded-lg hover:bg-surface-hover transition"
	>
		{formatDateLabel(date)}
	</button>
	<button
		type="button"
		onclick={next}
		class="p-2 rounded-lg hover:bg-surface-hover transition"
		aria-label="Next day"
		disabled={date >= todayString()}
	>
		<ChevronRight class="w-5 h-5" />
	</button>
</div>
