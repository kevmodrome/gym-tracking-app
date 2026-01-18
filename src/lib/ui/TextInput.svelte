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
		<label for={inputId} class="block text-sm font-medium text-text-secondary mb-2">
			{label}
			{#if required}<span class="text-danger">*</span>{/if}
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
		class="w-full px-4 py-3 text-base bg-surface-elevated border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent min-h-[44px] text-text-primary placeholder:text-text-muted {error ? 'border-danger' : 'border-border'} {disabled ? 'bg-surface opacity-60 cursor-not-allowed' : 'hover:border-border-active'}"
	/>
	{#if error}
		<p class="mt-1 text-sm text-danger">{error}</p>
	{:else if hint}
		<p class="mt-1 text-sm text-text-muted">{hint}</p>
	{/if}
</div>
