<script lang="ts">
	import type { Snippet } from 'svelte';
	import SearchInput from './SearchInput.svelte';

	interface FilterPanelProps {
		searchValue?: string;
		searchPlaceholder?: string;
		onSearchChange?: (value: string) => void;
		class?: string;
		children?: Snippet;
	}

	let {
		searchValue = $bindable(''),
		searchPlaceholder = 'Search...',
		onSearchChange,
		class: className = '',
		children
	}: FilterPanelProps = $props();

	function handleSearchChange(value: string) {
		searchValue = value;
		onSearchChange?.(value);
	}
</script>

<div class="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6 {className}">
	<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
		<SearchInput
			bind:value={searchValue}
			placeholder={searchPlaceholder}
			onchange={handleSearchChange}
		/>
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>
