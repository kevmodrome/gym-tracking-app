<script lang="ts">
	interface MetricCardProps {
		label: string;
		value: string | number;
		icon?: string;
		iconBgColor?: string;
		trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
		class?: string;
	}

	let {
		label,
		value,
		icon,
		iconBgColor = 'bg-accent/20',
		trend,
		class: className = ''
	}: MetricCardProps = $props();
</script>

<div class="bg-surface rounded-xl border border-border p-4 sm:p-6 {className}">
	<div class="flex items-center justify-between">
		<div>
			<p class="text-xs sm:text-sm font-medium text-text-secondary">{label}</p>
			<p class="text-2xl sm:text-3xl font-bold font-display text-text-primary">{value}</p>
			{#if trend}
				<div class="flex items-center mt-1 text-xs sm:text-sm {trend.direction === 'up' ? 'text-accent' : trend.direction === 'down' ? 'text-danger' : 'text-text-muted'}">
					{#if trend.direction === 'up'}
						<span>↑</span>
					{:else if trend.direction === 'down'}
						<span>↓</span>
					{:else}
						<span>→</span>
					{/if}
					<span class="ml-1">{trend.value}%</span>
				</div>
			{/if}
		</div>
		{#if icon}
			<div class="w-10 h-10 sm:w-12 sm:h-12 {iconBgColor} rounded-xl flex items-center justify-center">
				<span class="text-xl sm:text-2xl">{icon}</span>
			</div>
		{/if}
	</div>
</div>
