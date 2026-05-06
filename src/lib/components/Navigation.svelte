<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import {
		Home,
		Dumbbell,
		Apple,
		TrendingUp,
		Settings
	} from 'lucide-svelte';

	const navItems: { path: string; label: string; icon: typeof Home }[] = [
		{ path: '/', label: 'Today', icon: Home },
		{ path: '/train', label: 'Train', icon: Dumbbell },
		{ path: '/log', label: 'Fuel', icon: Apple },
		{ path: '/progress', label: 'Progress', icon: TrendingUp }
	];

	function isActive(path: string): boolean {
		const currentPath: string | undefined = page.url?.pathname;
		if (!currentPath) return false;
		if (path === '/') {
			return currentPath === '/';
		}
		// Match /train and sub-paths
		if (path === '/train') {
			return currentPath === '/train' || currentPath.startsWith('/train/');
		}
		// Match /log and /log/scan etc.
		if (path === '/log') {
			return currentPath === '/log' || currentPath.startsWith('/log/');
		}
		// Match /progress and all subroutes
		if (path === '/progress') {
			return currentPath === '/progress' || currentPath.startsWith('/progress/');
		}
		return currentPath.startsWith(path);
	}

	function isSettingsActive(): boolean {
		const currentPath: string | undefined = page.url?.pathname;
		if (!currentPath) return false;
		return currentPath === '/settings' || currentPath.startsWith('/settings/');
	}
</script>

<!-- Desktop Navigation Header -->
<nav
	class="hidden md:block fixed top-0 left-0 right-0 z-50 glass border-b border-border nav-desktop"
	transition:fly={{ y: -100, duration: 300 }}
>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between h-16">
			<div class="flex items-center gap-2">
				<Dumbbell class="w-8 h-8 text-accent" />
				<span class="text-xl font-bold font-display text-text-primary">GymTrack</span>
			</div>
			<div class="flex items-center gap-1">
				{#each navItems as item}
					{@const active = isActive(item.path)}
					<a
						href={item.path}
						class="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 {active
							? 'bg-accent/10 text-accent'
							: 'text-text-muted hover:text-text-primary hover:bg-surface-hover'}"
					>
						<svelte:component
							this={item.icon}
							class="w-5 h-5"
							strokeWidth={active ? 2.5 : 2}
						/>
						<span class="font-medium">{item.label}</span>
					</a>
				{/each}
			</div>
			<a
				href="/settings"
				aria-label="Settings"
				class="flex items-center justify-center w-10 h-10 rounded-full border border-border transition-all duration-200 {isSettingsActive()
					? 'bg-accent/10 text-accent border-accent/40'
					: 'bg-surface text-text-muted hover:text-text-primary hover:bg-surface-hover'}"
			>
				<Settings class="w-5 h-5" strokeWidth={isSettingsActive() ? 2.5 : 2} />
			</a>
		</div>
	</div>
</nav>

<!-- Mobile Navigation Footer -->
<nav
	class="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border md:hidden nav-mobile"
	transition:fly={{ y: 100, duration: 300 }}
>
	<div class="flex items-center justify-around h-20">
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

<style>
	/* Exclude navigation from view transitions so it stays stable during page navigation */
	.nav-desktop {
		view-transition-name: nav-desktop;
	}

	.nav-mobile {
		view-transition-name: nav-mobile;
	}
</style>
