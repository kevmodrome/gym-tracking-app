<script lang="ts">
	import Numeric from '$lib/ui/Numeric.svelte';
	import type { FoodMacros } from '$lib/types';

	interface Props {
		current: FoodMacros;
		target: FoodMacros;
	}

	const { current, target }: Props = $props();

	function clampPct(c: number, t: number): number {
		if (t <= 0) return 0;
		return Math.max(0, (c / t) * 100);
	}

	function fmt(n: number, unit: string): string {
		if (unit === 'kcal') return String(Math.round(n));
		return String(Math.round(n * 10) / 10);
	}

	// Goal-aware color for the kcal ring.
	// <=110% → focal lime; >110% → warning amber.
	const kcalPct = $derived(clampPct(current.kcal, target.kcal));
	const kcalOver = $derived(kcalPct > 110);
	const kcalStrokeVar = $derived(kcalOver ? 'var(--color-warning)' : 'var(--color-focal)');
	const kcalNumericTone = $derived<'focal' | 'default'>(kcalOver ? 'default' : 'focal');

	// Ring geometry (SVG concentric rings).
	// kcal (outer), protein, carbs, fat (inner).
	type Ring = {
		key: 'kcal' | 'protein' | 'carbs' | 'fat';
		label: string;
		unit: string;
		radius: number;
		stroke: string;
		current: number;
		target: number;
	};

	const rings = $derived<Ring[]>([
		{
			key: 'kcal',
			label: 'kcal',
			unit: 'kcal',
			radius: 86,
			stroke: kcalStrokeVar,
			current: current.kcal,
			target: target.kcal,
		},
		{
			key: 'protein',
			label: 'P',
			unit: 'g',
			radius: 70,
			stroke: 'var(--color-secondary)',
			current: current.protein,
			target: target.protein,
		},
		{
			key: 'carbs',
			label: 'C',
			unit: 'g',
			radius: 54,
			stroke: 'var(--color-warning)',
			current: current.carbs,
			target: target.carbs,
		},
		{
			key: 'fat',
			label: 'F',
			unit: 'g',
			radius: 38,
			stroke: 'var(--color-success)',
			current: current.fat,
			target: target.fat,
		},
	]);

	const STROKE_WIDTH = 10;
	const SIZE = 220;
	const CENTER = SIZE / 2;
</script>

<div class="flex flex-col items-center">
	<div
		class="relative w-full max-w-[280px] sm:max-w-[260px]"
		style="aspect-ratio: 1 / 1;"
	>
		<svg
			viewBox="0 0 {SIZE} {SIZE}"
			class="w-full h-full -rotate-90"
			aria-hidden="true"
		>
			{#each rings as r (r.key)}
				{@const circ = 2 * Math.PI * r.radius}
				{@const pct = clampPct(r.current, r.target)}
				{@const dash = (Math.min(100, pct) / 100) * circ}
				<circle
					cx={CENTER}
					cy={CENTER}
					r={r.radius}
					fill="none"
					stroke="var(--color-surface-hover)"
					stroke-width={STROKE_WIDTH}
				/>
				<circle
					cx={CENTER}
					cy={CENTER}
					r={r.radius}
					fill="none"
					stroke={r.stroke}
					stroke-width={STROKE_WIDTH}
					stroke-linecap="round"
					stroke-dasharray="{dash} {circ}"
					style="transition: stroke-dasharray 320ms ease, stroke 200ms ease;"
				/>
			{/each}
		</svg>

		<div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
			<Numeric value={Math.round(current.kcal)} tone={kcalNumericTone} size="hero" unit="kcal" />
			<div class="text-xs text-text-secondary mt-1 font-display tracking-wide uppercase">
				of {Math.round(target.kcal)}
			</div>
		</div>
	</div>

	<div class="grid grid-cols-3 gap-3 w-full max-w-md mt-4 text-center">
		{#each rings.slice(1) as r (r.key)}
			<div>
				<div class="flex items-center justify-center gap-1.5">
					<span
						class="inline-block w-2 h-2 rounded-full"
						style="background: {r.stroke};"
					></span>
					<span class="text-xs text-text-secondary uppercase tracking-wide font-display">{r.label}</span>
				</div>
				<div class="text-sm text-text-primary font-medium mt-0.5">
					{fmt(r.current, r.unit)} <span class="text-text-secondary">/ {fmt(r.target, r.unit)}{r.unit}</span>
				</div>
			</div>
		{/each}
	</div>
</div>
