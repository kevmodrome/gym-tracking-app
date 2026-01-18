<script lang="ts">
	import { page } from '$app/stores';
	import { fly } from 'svelte/transition';
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
	class="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border md:hidden"
	transition:fly={{ y: 100, duration: 300 }}
>
	<div class="flex items-center justify-around h-16">
		{#each navItems as item}
			{@const active = isActive(item.path)}
			<a
				href={item.path}
				class="flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] transition-all duration-200 {active ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}"
			>
				<div class="relative {active ? 'scale-110' : 'scale-100'} transition-transform duration-200">
					{#if active}
						<div class="absolute inset-0 bg-accent/20 blur-lg rounded-full"></div>
					{/if}
					<svelte:component
						this={item.icon}
						class="w-5 h-5 sm:w-6 sm:h-6 relative z-10 {active ? 'stroke-accent' : ''}"
						strokeWidth={active ? 2.5 : 2}
					/>
				</div>
				<span class="text-[10px] sm:text-xs mt-1 font-medium">{item.label}</span>
			</a>
		{/each}
	</div>

	<!-- Safe Area for devices with home indicators -->
	<div class="h-[env(safe-area-inset-bottom,0px)] bg-surface/90"></div>
</nav>
