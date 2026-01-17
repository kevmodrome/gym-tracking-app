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

	const textareaId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		oninput?.(e);
		onchange?.(target.value);
	}
</script>

<div class={className}>
	{#if label}
		<label for={textareaId} class="block text-sm font-medium text-gray-700 mb-2">
			{label}
			{#if required}<span class="text-red-500">*</span>{/if}
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
		class="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px] {disabled ? 'bg-gray-100 cursor-not-allowed' : ''}"
	></textarea>
	{#if hint}
		<p class="mt-1 text-sm text-gray-500">{hint}</p>
	{/if}
</div>
