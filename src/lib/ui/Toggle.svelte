<script lang="ts">
	interface ToggleProps {
		checked: boolean;
		label?: string;
		description?: string;
		disabled?: boolean;
		class?: string;
		onchange?: (checked: boolean) => void;
	}

	let {
		checked = $bindable(),
		label,
		description,
		disabled = false,
		class: className = '',
		onchange
	}: ToggleProps = $props();

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		checked = target.checked;
		onchange?.(target.checked);
	}
</script>

<div class="flex items-center justify-between {className}">
	{#if label || description}
		<div>
			{#if label}
				<h3 class="font-medium text-gray-900">{label}</h3>
			{/if}
			{#if description}
				<p class="text-sm text-gray-600">{description}</p>
			{/if}
		</div>
	{/if}
	<label class="relative inline-flex items-center cursor-pointer {disabled ? 'opacity-50 cursor-not-allowed' : ''}">
		<input
			type="checkbox"
			{checked}
			{disabled}
			onchange={handleChange}
			class="sr-only peer"
		/>
		<div
			class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
		></div>
	</label>
</div>
