<script lang="ts">
	interface ScannerMarkProps {
		size?: number;
		class?: string;
		strokeWidth?: number;
	}

	let { size = 24, class: className = '', strokeWidth = 2 }: ScannerMarkProps = $props();
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
	<!-- Reticle corners -->
	<path d="M4 8V5a1 1 0 0 1 1-1h3" />
	<path d="M16 4h3a1 1 0 0 1 1 1v3" />
	<path d="M20 16v3a1 1 0 0 1-1 1h-3" />
	<path d="M8 20H5a1 1 0 0 1-1-1v-3" />
	<!-- Barcode lines -->
	<line x1="8" y1="9" x2="8" y2="15" />
	<line x1="11" y1="9" x2="11" y2="15" />
	<line x1="13" y1="9" x2="13" y2="15" />
	<line x1="16" y1="9" x2="16" y2="15" />
</svg>
