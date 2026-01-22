<script lang="ts">
	import { MoreVertical, StickyNote, Gauge, Trash2, Pencil, X } from 'lucide-svelte';

	interface SessionOverflowMenuProps {
		onAddNote: () => void;
		onSetRPE: () => void;
		onDeleteSet: () => void;
		onEditExercise: () => void;
		onDeleteExercise: () => void;
		isLibraryExercise?: boolean;
	}

	let {
		onAddNote,
		onSetRPE,
		onDeleteSet,
		onEditExercise,
		onDeleteExercise,
		isLibraryExercise = false
	}: SessionOverflowMenuProps = $props();

	let isOpen = $state(false);
	let menuRef = $state<HTMLDivElement | null>(null);

	function toggleMenu() {
		isOpen = !isOpen;
	}

	function closeMenu() {
		isOpen = false;
	}

	function handleAction(action: () => void) {
		action();
		closeMenu();
	}

	// Close menu when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (menuRef && !menuRef.contains(event.target as Node)) {
			closeMenu();
		}
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

<div class="relative" bind:this={menuRef}>
	<button
		type="button"
		onclick={toggleMenu}
		class="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
		aria-label="More options"
		aria-expanded={isOpen}
		aria-haspopup="menu"
	>
		<MoreVertical class="w-5 h-5" />
	</button>

	{#if isOpen}
		<div
			class="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden"
			role="menu"
		>
			<!-- Set Actions -->
			<div class="px-3 py-1.5">
				<p class="text-xs text-text-muted uppercase tracking-wide">Set</p>
			</div>

			<button
				type="button"
				onclick={() => handleAction(onAddNote)}
				class="w-full flex items-center gap-3 px-4 py-3 text-left text-text-primary hover:bg-surface-elevated transition-colors"
				role="menuitem"
			>
				<StickyNote class="w-4 h-4 text-text-secondary" />
				<span>Add Note to Set</span>
			</button>

			<button
				type="button"
				onclick={() => handleAction(onSetRPE)}
				class="w-full flex items-center gap-3 px-4 py-3 text-left text-text-primary hover:bg-surface-elevated transition-colors"
				role="menuitem"
			>
				<Gauge class="w-4 h-4 text-text-secondary" />
				<span>Set RPE</span>
			</button>

			<button
				type="button"
				onclick={() => handleAction(onDeleteSet)}
				class="w-full flex items-center gap-3 px-4 py-3 text-left text-danger hover:bg-danger/10 transition-colors"
				role="menuitem"
			>
				<Trash2 class="w-4 h-4" />
				<span>Delete Set</span>
			</button>

			<div class="border-t border-border my-1"></div>

			<!-- Exercise Actions -->
			<div class="px-3 py-1.5">
				<p class="text-xs text-text-muted uppercase tracking-wide">Exercise</p>
			</div>

			<button
				type="button"
				onclick={() => handleAction(onEditExercise)}
				disabled={isLibraryExercise}
				class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed
					{isLibraryExercise ? 'text-text-muted' : 'text-text-primary hover:bg-surface-elevated'}"
				role="menuitem"
			>
				<Pencil class="w-4 h-4 text-text-secondary" />
				<div class="flex-1">
					<span>Edit Exercise</span>
					{#if isLibraryExercise}
						<p class="text-xs text-text-muted">Library exercises can't be edited</p>
					{/if}
				</div>
			</button>

			<button
				type="button"
				onclick={() => handleAction(onDeleteExercise)}
				class="w-full flex items-center gap-3 px-4 py-3 text-left text-danger hover:bg-danger/10 transition-colors"
				role="menuitem"
			>
				<X class="w-4 h-4" />
				<span>Delete Exercise</span>
			</button>
		</div>
	{/if}
</div>
