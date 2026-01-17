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
			class="rounded-lg transition-colors whitespace-nowrap {sizeClasses[size]} {value === option.value
				? 'bg-blue-600 text-white'
				: 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}"
		>
			{option.label}
		</button>
	{/each}
</div>
