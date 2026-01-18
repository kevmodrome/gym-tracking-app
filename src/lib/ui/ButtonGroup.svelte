<script lang="ts">
	interface ButtonGroupOption {
		value: string;
		label: string;
	}

	interface ButtonGroupProps {
		options: ButtonGroupOption[];
		value: string;
		size?: 'sm' | 'md';
		class?: string;
		onchange: (value: string) => void;
	}

	let {
		options,
		value = $bindable(),
		size = 'md',
		class: className = '',
		onchange
	}: ButtonGroupProps = $props();

	const sizeClasses = {
		sm: 'px-2 sm:px-3 py-1.5 text-xs sm:text-sm min-h-[36px]',
		md: 'px-3 sm:px-4 py-2 text-sm min-h-[44px]'
	};

	function handleClick(optionValue: string) {
		value = optionValue;
		onchange(optionValue);
	}
</script>

<div class="flex gap-1 sm:gap-2 overflow-x-auto pb-1 {className}">
	{#each options as option}
		<button
			onclick={() => handleClick(option.value)}
			type="button"
			class="rounded-lg transition-all duration-200 whitespace-nowrap font-medium {sizeClasses[size]} {value === option.value
				? 'bg-accent text-bg shadow-[0_0_15px_rgba(197,255,0,0.2)]'
				: 'bg-surface text-text-secondary hover:bg-surface-elevated hover:text-text-primary border border-border'}"
		>
			{option.label}
		</button>
	{/each}
</div>
