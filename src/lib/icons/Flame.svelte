<script lang="ts">
	interface FlameProps {
		size?: number;
		class?: string;
		strokeWidth?: number;
	}

	let { size = 24, class: className = '', strokeWidth = 1.75 }: FlameProps = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	aria-hidden="true"
>
	<path d="M12 2.5c1.4 3.2 4.6 4.8 4.6 8.4a4.6 4.6 0 0 1-1.4 3.3c.6-2.4-1.1-4.6-3.2-5.6.4 2.2-.7 3.4-1.9 4.6A5.4 5.4 0 0 0 8.4 17a5.6 5.6 0 0 0 11.2 0c0-3.5-2.2-5.5-3.9-7.6C13.9 7.2 12.7 5 12 2.5Z" />
</svg>
