<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import {
		Button,
		ButtonGroup,
		Card,
		EmptyState,
		Modal,
		NumberSpinner,
		Numeric
	} from '$lib/ui';
	import WeightChart from '$lib/components/WeightChart.svelte';
	import { Plot, Line, Dot } from 'svelteplot';
	import {
		listWeights,
		upsertWeightForDate,
		latestWeightKg,
		dailyTotals
	} from '$lib/nutrition/db';
	import { addDays, todayString } from '$lib/nutrition/dates';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { BodyMetric, FoodMacros, Weight } from '$lib/types';
	import { Plus, Ruler, Scale } from 'lucide-svelte';

	const bodyMetricsCol = db.collection('bodyMetrics');

	// ---------- Weight ----------
	let kg = $state<number>(80);
	let weights = $state<Weight[]>([]);

	// ---------- Nutrition trend ----------
	let nutritionRange = $state<30 | 90>(30);
	let nutritionRows = $state<{ date: Date; kcal: number; protein: number }[]>([]);

	// ---------- Body metrics ----------
	let bodyMetrics = $state<BodyMetric[]>([]);
	let showLogMetricModal = $state(false);
	let metricDate = $state(todayString());
	let metricWaist = $state<number | undefined>(undefined);
	let metricBodyFat = $state<number | undefined>(undefined);

	async function refreshAll() {
		weights = await listWeights();
		const w = await latestWeightKg();
		if (w !== null) kg = w;
		bodyMetrics = ((await bodyMetricsCol.get()) as BodyMetric[]).sort((a, b) =>
			a.date.localeCompare(b.date)
		);
		await loadNutrition();
	}

	async function loadNutrition() {
		const today = todayString();
		const rows: { date: Date; kcal: number; protein: number }[] = [];
		for (let i = nutritionRange - 1; i >= 0; i--) {
			const d = addDays(today, -i);
			const totals: FoodMacros = await dailyTotals(d);
			const [y, m, day] = d.split('-').map(Number);
			rows.push({
				date: new Date(y, m - 1, day),
				kcal: totals.kcal,
				protein: totals.protein
			});
		}
		nutritionRows = rows;
	}

	$effect(() => {
		// Reload when range changes
		nutritionRange;
		loadNutrition();
	});

	onMount(refreshAll);

	async function saveWeight() {
		await upsertWeightForDate(todayString(), kg);
		weights = await listWeights();
		toastStore.showSuccess('Weight saved');
	}

	function openLogMetric() {
		metricDate = todayString();
		metricWaist = undefined;
		metricBodyFat = undefined;
		showLogMetricModal = true;
	}

	async function saveBodyMetric() {
		if (metricWaist === undefined && metricBodyFat === undefined) {
			toastStore.showError('Add at least one measurement');
			return;
		}
		const entry: Omit<BodyMetric, 'id'> = {
			date: metricDate,
			loggedAt: new Date().toISOString()
		};
		if (metricWaist !== undefined) entry.waistCm = metricWaist;
		if (metricBodyFat !== undefined) entry.bodyFatPct = metricBodyFat;
		await bodyMetricsCol.add(entry);
		showLogMetricModal = false;
		bodyMetrics = ((await bodyMetricsCol.get()) as BodyMetric[]).sort((a, b) =>
			a.date.localeCompare(b.date)
		);
		toastStore.showSuccess('Measurement saved');
	}

	const latestWeight = $derived(
		weights.length > 0 ? weights[weights.length - 1] : null
	);

	const kcalSeries = $derived(nutritionRows.map((r) => ({ x: r.date, y: r.kcal })));
	const proteinSeries = $derived(nutritionRows.map((r) => ({ x: r.date, y: r.protein })));

	const hasNutrition = $derived(
		nutritionRows.some((r) => r.kcal > 0 || r.protein > 0)
	);

	const isFullyEmpty = $derived(
		weights.length === 0 && bodyMetrics.length === 0 && !hasNutrition
	);

	function formatShortDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

{#if isFullyEmpty}
	<Card padding="lg">
		{#snippet children()}
			<EmptyState
				title="No body data yet"
				description="Log your weight, nutrition, or a measurement to start tracking trends."
			>
				{#snippet icon()}<Scale />{/snippet}
			</EmptyState>
			<div class="mt-4 flex flex-wrap gap-2 justify-center">
				<Button variant="primary" onclick={saveWeight}>Log today's weight</Button>
				<Button variant="secondary" onclick={openLogMetric}>Log measurement</Button>
			</div>
		{/snippet}
	</Card>
{:else}
	<!-- Hero: latest weight -->
	{#if latestWeight}
		<section class="mb-6">
			<Card padding="md">
				{#snippet children()}
					<p class="text-xs sm:text-sm text-text-secondary mb-1">Latest weight</p>
					<div class="flex items-baseline gap-3">
						<Numeric value={latestWeight.kg.toFixed(1)} size="hero" tone="focal" unit="kg" />
						<span class="text-xs text-text-muted">{formatShortDate(latestWeight.date)}</span>
					</div>
				{/snippet}
			</Card>
		</section>
	{/if}

	<!-- Weight log + chart -->
	<section class="mb-6">
		<Card>
			{#snippet children()}
				<div class="flex items-center justify-between mb-4 flex-wrap gap-2">
					<h2 class="font-display font-bold text-lg text-text-primary">Weight</h2>
				</div>
				<div class="flex items-end gap-3 mb-4">
					<div class="flex-1">
						<NumberSpinner
							bind:value={kg}
							label="Today's weight (kg)"
							min={30}
							max={250}
							step={0.1}
						/>
					</div>
					<Button onclick={saveWeight}>Save</Button>
				</div>
				<WeightChart data={weights} />
			{/snippet}
		</Card>
	</section>

	<!-- Nutrition trend -->
	<section class="mb-6">
		<Card>
			{#snippet children()}
				<div class="flex items-center justify-between mb-4 flex-wrap gap-2">
					<h2 class="font-display font-bold text-lg text-text-primary">Nutrition trend</h2>
					<ButtonGroup
						options={[
							{ value: '30', label: '30d' },
							{ value: '90', label: '90d' }
						]}
						value={String(nutritionRange)}
						onchange={(v) => (nutritionRange = Number(v) as 30 | 90)}
					/>
				</div>

				{#if !hasNutrition}
					<p class="text-sm text-text-secondary text-center py-6">
						No nutrition logged in the last {nutritionRange} days.
					</p>
				{:else}
					<div class="space-y-5">
						<div>
							<p class="text-xs uppercase tracking-wider text-text-muted font-semibold mb-2">
								kcal per day
							</p>
							<div class="h-48">
								<Plot height={192} marginLeft={48} marginBottom={32}>
									<Line
										data={kcalSeries}
										x="x"
										y="y"
										stroke="var(--color-accent)"
										strokeWidth={2}
									/>
									<Dot data={kcalSeries} x="x" y="y" fill="var(--color-accent)" r={3} />
								</Plot>
							</div>
						</div>
						<div>
							<p class="text-xs uppercase tracking-wider text-text-muted font-semibold mb-2">
								Protein per day (g)
							</p>
							<div class="h-48">
								<Plot height={192} marginLeft={48} marginBottom={32}>
									<Line
										data={proteinSeries}
										x="x"
										y="y"
										stroke="var(--color-secondary)"
										strokeWidth={2}
									/>
									<Dot
										data={proteinSeries}
										x="x"
										y="y"
										fill="var(--color-secondary)"
										r={3}
									/>
								</Plot>
							</div>
						</div>
					</div>
				{/if}
			{/snippet}
		</Card>
	</section>

	<!-- Body measurements -->
	<section class="mb-6">
		<Card>
			{#snippet children()}
				<div class="flex items-center justify-between mb-4 flex-wrap gap-2">
					<h2 class="font-display font-bold text-lg text-text-primary">Measurements</h2>
					<Button variant="secondary" size="sm" onclick={openLogMetric}>
						<Plus class="w-4 h-4" /> Log measurement
					</Button>
				</div>

				{#if bodyMetrics.length === 0}
					<p class="text-sm text-text-secondary text-center py-6">
						No measurements logged yet. Track waist or body-fat % to spot trends.
					</p>
				{:else}
					<ul class="divide-y divide-border">
						{#each [...bodyMetrics].reverse() as m (m.id)}
							<li class="flex items-center justify-between py-3">
								<div class="flex items-center gap-3">
									<Ruler class="w-4 h-4 text-text-muted" />
									<div>
										<p class="text-sm text-text-primary font-medium">
											{formatShortDate(m.date)}
										</p>
										<p class="text-xs text-text-muted">
											{#if m.waistCm !== undefined}Waist {m.waistCm} cm{/if}
											{#if m.waistCm !== undefined && m.bodyFatPct !== undefined} · {/if}
											{#if m.bodyFatPct !== undefined}Body fat {m.bodyFatPct}%{/if}
										</p>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			{/snippet}
		</Card>
	</section>
{/if}

<!-- Log measurement modal -->
<Modal
	open={showLogMetricModal}
	title="Log measurement"
	size="sm"
	onclose={() => (showLogMetricModal = false)}
>
	{#snippet children()}
		<div class="space-y-4">
			<div>
				<label
					for="metric-date"
					class="block text-xs sm:text-sm font-medium text-text-secondary mb-1"
				>
					Date
				</label>
				<input
					id="metric-date"
					type="date"
					bind:value={metricDate}
					class="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm text-text-primary min-h-[44px]"
				/>
			</div>
			<NumberSpinner
				label="Waist (cm) — optional"
				value={metricWaist ?? 0}
				min={0}
				max={300}
				step={0.5}
				onchange={(v) => (metricWaist = v > 0 ? v : undefined)}
			/>
			<NumberSpinner
				label="Body fat (%) — optional"
				value={metricBodyFat ?? 0}
				min={0}
				max={70}
				step={0.1}
				onchange={(v) => (metricBodyFat = v > 0 ? v : undefined)}
			/>
		</div>
	{/snippet}
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (showLogMetricModal = false)}>Cancel</Button>
		<Button variant="primary" onclick={saveBodyMetric}>Save</Button>
	{/snippet}
</Modal>
