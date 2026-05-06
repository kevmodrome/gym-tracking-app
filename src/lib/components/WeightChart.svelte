<script lang="ts">
	import { Plot, Line, Dot } from 'svelteplot';
	import type { Weight } from '$lib/types';

	interface Props { data: Weight[]; }
	const { data }: Props = $props();

	const points = $derived(data.map((w) => ({ x: w.date, y: w.kg })));
</script>

{#if points.length === 0}
	<p class="text-sm text-text-secondary text-center py-6">No weight data yet.</p>
{:else}
	<Plot height={240} marginLeft={48} marginBottom={32}>
		<Line data={points} x="x" y="y" stroke="var(--color-accent)" />
		<Dot data={points} x="x" y="y" fill="var(--color-accent)" />
	</Plot>
{/if}
