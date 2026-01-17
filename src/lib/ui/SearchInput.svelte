<script lang="ts">
	import SearchIcon from '$lib/components/SearchIcon.svelte';

	interface SearchInputProps {
		value: string;
		placeholder?: string;
		id?: string;
		disabled?: boolean;
		class?: string;
		onchange?: (value: string) => void;
		oninput?: (e: Event) => void;
	}

	let {
		value = $bindable(),
		placeholder = 'Search...',
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

<div class="relative {className}">
	<SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
	<input
		id={inputId}
		type="text"
		{value}
		{placeholder}
		{disabled}
		oninput={handleInput}
		class="w-full pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base min-h-[44px] {disabled ? 'bg-gray-100 cursor-not-allowed' : ''}"
	/>
</div>
