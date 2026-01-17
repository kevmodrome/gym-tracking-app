<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	let touchStartX = 0;
	let touchEndX = 0;
	const minSwipeDistance = 100;

	onMount(() => {
		if (!browser) return;

		const handleTouchStart = (e: TouchEvent) => {
			touchStartX = e.changedTouches[0].screenX;
		};

		const handleTouchEnd = (e: TouchEvent) => {
			touchEndX = e.changedTouches[0].screenX;
			handleSwipe();
		};

		document.addEventListener('touchstart', handleTouchStart, { passive: true });
		document.addEventListener('touchend', handleTouchEnd, { passive: true });

		onDestroy(() => {
			document.removeEventListener('touchstart', handleTouchStart);
			document.removeEventListener('touchend', handleTouchEnd);
		});
	});

	function handleSwipe() {
		const distance = touchStartX - touchEndX;

		if (Math.abs(distance) > minSwipeDistance) {
			if (distance > 0) {
				console.log('Swipe left detected - going back');
			} else {
				console.log('Swipe right detected - going back');
				window.history.back();
			}
		}
	}
</script>