<script lang="ts">
	interface TextInputProps {
		value: string;
		label?: string;
		placeholder?: string;
		id?: string;
		type?: 'text' | 'email' | 'password' | 'number';
		required?: boolean;
		disabled?: boolean;
		error?: string;
		hint?: string;
		autofocus?: boolean;
		min?: number;
		max?: number;
		inputmode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'search' | 'url';
		class?: string;
		onchange?: (value: string) => void;
		oninput?: (e: Event) => void;
		onblur?: (e: FocusEvent) => void;
	}

	let {
		value = $bindable(),
		label,
		placeholder = '',
		id,
		type = 'text',
		required = false,
		disabled = false,
		error,
		hint,
		autofocus = false,
		min,
		max,
		inputmode,
		class: className = '',
		onchange,
		oninput,
		onblur
	}: TextInputProps = $props();

	const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		oninput?.(e);
		onchange?.(target.value);
	}
</script>

<div class={className}>
	{#if label}
		<label for={inputId} class="block text-sm font-medium text-gray-700 mb-2">
			{label}
			{#if required}<span class="text-red-500">*</span>{/if}
		</label>
	{/if}
	<!-- svelte-ignore a11y_autofocus -->
	<input
		{...{ type }}
		id={inputId}
		{value}
		{placeholder}
		{required}
		{disabled}
		{autofocus}
		{min}
		{max}
		{inputmode}
		oninput={handleInput}
		{onblur}
		class="w-full px-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px] {error ? 'border-red-500' : 'border-gray-300'} {disabled ? 'bg-gray-100 cursor-not-allowed' : ''}"
	/>
	{#if error}
		<p class="mt-1 text-sm text-red-600">{error}</p>
	{:else if hint}
		<p class="mt-1 text-sm text-gray-500">{hint}</p>
	{/if}
</div>
