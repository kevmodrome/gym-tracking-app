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
		iconBgColor = 'bg-blue-100',
		trend,
		class: className = ''
	}: MetricCardProps = $props();
</script>

<div class="bg-white rounded-lg shadow-md p-4 sm:p-6 {className}">
	<div class="flex items-center justify-between">
		<div>
			<p class="text-xs sm:text-sm font-medium text-gray-500">{label}</p>
			<p class="text-2xl sm:text-3xl font-bold text-gray-900">{value}</p>
			{#if trend}
				<div class="flex items-center mt-1 text-xs sm:text-sm {trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-gray-500'}">
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
			<div class="w-10 h-10 sm:w-12 sm:h-12 {iconBgColor} rounded-full flex items-center justify-center">
				<span class="text-xl sm:text-2xl">{icon}</span>
			</div>
		{/if}
	</div>
</div>
