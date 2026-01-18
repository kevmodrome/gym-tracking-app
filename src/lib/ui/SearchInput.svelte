<script lang="ts">
	import SearchIcon from '$lib/components/SearchIcon.svelte';

	interface SearchInputProps {
		value: string;
		placeholder?: string;
		label?: string;
		id?: string;
		disabled?: boolean;
		class?: string;
		onchange?: (value: string) => void;
		oninput?: (e: Event) => void;
	}

	let {
		value = $bindable(),
		placeholder = 'Search...',
		label,
		id,
		disabled = false,
		class: className = '',
		onchange,
		oninput
	}: SearchInputProps = $props();

	const inputId = id || `search-${Math.random().toString(36).slice(2, 9)}`;

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
		</label>
	{/if}
	<div class="relative">
		<SearchIcon class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
		<input
			id={inputId}
			type="text"
			{value}
			{placeholder}
			{disabled}
			oninput={handleInput}
			class="w-full pl-12 pr-4 py-3 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-text-primary placeholder:text-text-muted text-base min-h-[44px] transition-colors {disabled ? 'opacity-50 cursor-not-allowed' : ''}"
		/>
	</div>
</div>
