<script lang="ts">
	type Size = 'inline' | 'hero' | 'display';
	type Tone = 'default' | 'focal' | 'streak' | 'pr';

	interface NumericProps {
		value: string | number;
		size?: Size;
		tone?: Tone;
		unit?: string;
		class?: string;
	}

	let {
		value,
		size = 'hero',
		tone = 'default',
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

	const toneClasses: Record<Tone, { number: string; unit: string }> = {
		default: { number: 'text-text-primary', unit: 'text-text-secondary' },
		focal: { number: 'text-focal', unit: 'text-focal/60' },
		streak: { number: 'text-streak', unit: 'text-streak/60' },
		pr: { number: 'text-pr', unit: 'text-pr/60' }
	};

	const numberClasses = $derived(
		[
			'font-display',
			'leading-none',
			sizeStyles[size],
			toneClasses[tone].number,
			className
		]
			.filter(Boolean)
			.join(' ')
	);

	const unitClasses = $derived(
		[
			'font-display font-semibold align-baseline',
			unitSizeStyles[size],
			toneClasses[tone].unit
		].join(' ')
	);
</script>

<span class={numberClasses}>
	{value}{#if unit}<span class={unitClasses}>{unit}</span>{/if}
</span>
