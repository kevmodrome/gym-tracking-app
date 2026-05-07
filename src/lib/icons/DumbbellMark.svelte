<script lang="ts">
	interface DumbbellMarkProps {
		size?: number;
		class?: string;
		strokeWidth?: number;
	}

	let { size = 24, class: className = '', strokeWidth = 2 }: DumbbellMarkProps = $props();
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
	<rect x="2" y="8" width="3" height="8" rx="0.5" />
	<rect x="19" y="8" width="3" height="8" rx="0.5" />
	<rect x="5" y="10" width="2" height="4" />
	<rect x="17" y="10" width="2" height="4" />
	<line x1="7" y1="12" x2="17" y2="12" />
</svg>
