<script lang="ts">
	interface SelectOption {
		value: string | number;
		label: string;
	}

	interface SelectProps {
		value: string | number;
		options: SelectOption[];
		label?: string;
		placeholder?: string;
		id?: string;
		required?: boolean;
		disabled?: boolean;
		hint?: string;
		class?: string;
		onchange?: (value: string | number) => void;
	}

	let {
		value = $bindable(),
		options,
		label,
		placeholder,
		id,
		required = false,
		disabled = false,
		hint,
		class: className = '',
		onchange
	}: SelectProps = $props();

	const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`;

	function handleChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const newValue = typeof value === 'number' ? Number(target.value) : target.value;
		value = newValue;
		onchange?.(newValue);
	}
</script>

<div class={className}>
	{#if label}
		<label for={selectId} class="block text-sm font-medium text-gray-700 mb-2">
			{label}
			{#if required}<span class="text-red-500">*</span>{/if}
		</label>
	{/if}
	<select
		id={selectId}
		{value}
		{required}
		{disabled}
		onchange={handleChange}
		class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px] {disabled ? 'bg-gray-100 cursor-not-allowed' : ''}"
	>
		{#if placeholder}
			<option value="" disabled>{placeholder}</option>
		{/if}
		{#each options as option}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
	{#if hint}
		<p class="mt-1 text-sm text-gray-500">{hint}</p>
	{/if}
</div>
