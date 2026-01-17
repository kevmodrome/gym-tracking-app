<script lang="ts">
	import { page } from '$app/stores';
	import { fade, fly } from 'svelte/transition';
	import {
		Dumbbell,
		TrendingUp,
		Trophy,
		BarChart3,
		History as HistoryIcon,
		Settings
	} from 'lucide-svelte';

	const navItems = [
		{ path: '/', label: 'Exercises', icon: Dumbbell },
		{ path: '/workout', label: 'Workout', icon: TrendingUp },
		{ path: '/pr', label: 'Records', icon: Trophy },
		{ path: '/history', label: 'History', icon: HistoryIcon },
		{ path: '/progress', label: 'Progress', icon: BarChart3 },
		{ path: '/settings', label: 'Settings', icon: Settings }
	];

	function isActive(path: string): boolean {
		const currentPath = $page.url.pathname;
		if (path === '/') {
			return currentPath === '/';
		}
		return currentPath.startsWith(path);
	}
</script>

<nav
	class="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden"
	transition:fly={{ y: 100, duration: 300 }}
>
	<div class="flex items-center justify-around h-16">
		{#each navItems as item}
			{@const active = isActive(item.path)}
			<a
				href={item.path}
				class="flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] transition-all duration-200"
				class:active-nav={active}
				class:inactive-nav={!active}
				transition:fade={{ duration: 200 }}
			>
				<div class={`relative ${active ? "nav-icon-active" : "nav-icon-inactive"}`}>
					<svelte:component this={item.icon} class={active ? "w-6 h-6" : "w-5 h-5"} />
				</div>
				<span class="text-xs mt-1 font-medium">{item.label}</span>
			</a>
		{/each}
	</div>

	<!-- Safe Area for devices with home indicators -->
	<div class="h-[env(safe-area-inset-bottom,0px)] bg-white"></div>
</nav>

<style>
	.active-nav {
		color: rgb(79 70 229);
	}

	.inactive-nav {
		color: rgb(107 114 128);
	}

	.nav-icon-active {
		stroke: rgb(79 70 229);
	}

	.nav-icon-inactive {
		stroke: rgb(107 114 128);
	}
</style>
