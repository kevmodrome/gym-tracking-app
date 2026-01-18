<script lang="ts">
	interface TextareaProps {
		value: string;
		label?: string;
		placeholder?: string;
		id?: string;
		rows?: number;
		required?: boolean;
		disabled?: boolean;
		hint?: string;
		class?: string;
		onchange?: (value: string) => void;
		oninput?: (e: Event) => void;
	}

	let {
		value = $bindable(),
		label,
		placeholder = '',
		id,
		rows = 3,
		required = false,
		disabled = false,
		hint,
		class: className = '',
		onchange,
		oninput
	}: TextareaProps = $props();

	const fallbackId = `textarea-${Math.random().toString(36).slice(2, 9)}`;
	const textareaId = $derived(id || fallbackId);

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		oninput?.(e);
		onchange?.(target.value);
	}
</script>

<div class={className}>
	{#if label}
		<label for={textareaId} class="block text-sm font-medium text-text-secondary mb-2">
			{label}
			{#if required}<span class="text-danger">*</span>{/if}
		</label>
	{/if}
	<textarea
		id={textareaId}
		{value}
		{placeholder}
		{rows}
		{required}
		{disabled}
		oninput={handleInput}
		class="w-full px-4 py-3 text-base bg-surface-elevated border border-border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent min-h-[44px] text-text-primary placeholder:text-text-muted {disabled ? 'bg-surface opacity-60 cursor-not-allowed' : 'hover:border-border-active'}"
	></textarea>
	{#if hint}
		<p class="mt-1 text-sm text-text-muted">{hint}</p>
	{/if}
</div>
