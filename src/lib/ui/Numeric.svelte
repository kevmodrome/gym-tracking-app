<script lang="ts">
	type Size = 'inline' | 'hero' | 'display';

	interface NumericProps {
		value: string | number;
		size?: Size;
		accent?: boolean;
		unit?: string;
		class?: string;
	}

	let {
		value,
		size = 'hero',
		accent = false,
		unit,
		class: className = ''
	}: NumericProps = $props();

	const sizeStyles: Record<Size, string> = {
		inline: 'text-2xl font-bold',
		hero: 'text-5xl font-bold tracking-tight',
		display: 'text-7xl font-extrabold tracking-tighter'
	};

	const unitSizeStyles: Record<Size, string> = {
		inline: 'text-sm ml-1',
		hero: 'text-xl ml-1.5',
		display: 'text-2xl ml-2'
	};

	const numberClasses = $derived(
		[
			'font-display',
			'leading-none',
			sizeStyles[size],
			accent ? 'text-focal' : 'text-text-primary',
			className
		]
			.filter(Boolean)
			.join(' ')
	);

	const unitClasses = $derived(
		[
			'font-display font-semibold align-baseline',
			unitSizeStyles[size],
			accent ? 'text-focal/60' : 'text-text-secondary'
		].join(' ')
	);
</script>

<span class={numberClasses}>
	{value}{#if unit}<span class={unitClasses}>{unit}</span>{/if}
</span>
