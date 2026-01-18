<script lang="ts">
	interface NumberSpinnerProps {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		label?: string;
		id?: string;
		disabled?: boolean;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
		onchange?: (value: number) => void;
	}

	let {
		value = $bindable(),
		min = 0,
		max = Infinity,
		step = 1,
		label,
		id,
		disabled = false,
		size = 'md',
		class: className = '',
		onchange
	}: NumberSpinnerProps = $props();

	const inputId = id || `spinner-${Math.random().toString(36).slice(2, 9)}`;

	const sizeClasses = {
		sm: {
			button: 'px-2 py-2 text-base min-w-[36px] min-h-[36px]',
			input: 'px-2 py-2 text-lg'
		},
		md: {
			button: 'px-3 sm:px-4 py-3 text-lg sm:text-xl min-w-[44px] min-h-[44px]',
			input: 'px-3 sm:px-4 py-3 text-xl sm:text-2xl'
		},
		lg: {
			button: 'px-4 py-4 text-xl min-w-[52px] min-h-[52px]',
			input: 'px-4 py-4 text-2xl'
		}
	};

	function decrement() {
		const newValue = Math.max(min, value - step);
		value = newValue;
		onchange?.(newValue);
	}

	function increment() {
		const newValue = Math.min(max, value + step);
		value = newValue;
		onchange?.(newValue);
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		let newValue = Number(target.value);
		if (isNaN(newValue)) newValue = min;
		newValue = Math.max(min, Math.min(max, newValue));
		value = newValue;
		onchange?.(newValue);
	}
</script>

<div class={className}>
	{#if label}
		<label for={inputId} class="block text-xs sm:text-sm font-medium text-text-secondary mb-1 sm:mb-2">
			{label}
		</label>
	{/if}
	<div class="flex gap-1">
		<button
			onclick={decrement}
			{disabled}
			type="button"
			class="bg-surface-elevated border border-border text-text-primary rounded-l-lg hover:bg-surface-hover hover:border-border-active font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 {sizeClasses[size].button}"
			aria-label="Decrease {label || 'value'}"
		>
			-
		</button>
		<input
			id={inputId}
			type="number"
			{min}
			{max}
			inputmode="numeric"
			{value}
			{disabled}
			oninput={handleInput}
			class="flex-1 font-bold font-display text-center bg-surface-elevated border-y border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent min-h-[44px] disabled:bg-surface disabled:opacity-60 disabled:cursor-not-allowed {sizeClasses[size].input}"
		/>
		<button
			onclick={increment}
			{disabled}
			type="button"
			class="bg-surface-elevated border border-border text-text-primary rounded-r-lg hover:bg-surface-hover hover:border-border-active font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 {sizeClasses[size].button}"
			aria-label="Increase {label || 'value'}"
		>
			+
		</button>
	</div>
</div>
