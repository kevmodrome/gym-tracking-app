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
		size?: 'sm' | 'md';
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
		size = 'md',
		class: className = '',
		onchange
	}: SelectProps = $props();

	const sizeClasses = {
		sm: 'pl-3 pr-8 py-2 text-sm',
		md: 'pl-4 pr-10 py-3 text-base'
	};

	const fallbackId = `select-${Math.random().toString(36).slice(2, 9)}`;
	const selectId = $derived(id || fallbackId);

	function handleChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const newValue = typeof value === 'number' ? Number(target.value) : target.value;
		value = newValue;
		onchange?.(newValue);
	}
</script>

<div class={className}>
	{#if label}
		<label for={selectId} class="block text-sm font-medium text-text-secondary mb-2">
			{label}
			{#if required}<span class="text-danger">*</span>{/if}
		</label>
	{/if}
	<select
		id={selectId}
		{value}
		{required}
		{disabled}
		onchange={handleChange}
		class="w-full {sizeClasses[size]} bg-surface-elevated border border-border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent min-h-[44px] text-text-primary {disabled ? 'bg-surface opacity-60 cursor-not-allowed' : 'hover:border-border-active'}"
	>
		{#if placeholder}
			<option value="" disabled class="bg-surface-elevated text-text-muted">{placeholder}</option>
		{/if}
		{#each options as option}
			<option value={option.value} class="bg-surface-elevated text-text-primary">{option.label}</option>
		{/each}
	</select>
	{#if hint}
		<p class="mt-1 text-sm text-text-muted">{hint}</p>
	{/if}
</div>
