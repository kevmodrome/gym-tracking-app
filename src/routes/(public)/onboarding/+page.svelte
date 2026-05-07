<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/ui';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import {
		Dumbbell,
		Flame,
		Activity,
		Target,
		Gauge,
		Layers,
		CheckCircle2,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';
	import type { OnboardingGoal, TrackingDepth, WeightUnit } from '$lib/types';

	type Step = 0 | 1 | 2 | 3;

	let step = $state<Step>(0);
	let direction = $state<'forward' | 'backward'>('forward');
	let goal = $state<OnboardingGoal | null>(null);
	let depth = $state<TrackingDepth | null>(null);
	let unit = $state<WeightUnit>('kg');
	let prefersReducedMotion = $state(false);
	let mounted = $state(false);

	onMount(() => {
		// Pre-select unit based on locale
		try {
			const lang = (navigator.language || 'en').toLowerCase();
			// US uses lb; default kg elsewhere
			if (lang.startsWith('en-us')) {
				unit = 'lb';
			} else {
				unit = 'kg';
			}
		} catch {
			unit = 'kg';
		}

		try {
			prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		} catch {
			prefersReducedMotion = false;
		}

		mounted = true;
	});

	const goalOptions: Array<{
		value: OnboardingGoal;
		title: string;
		desc: string;
		Icon: typeof Dumbbell;
	}> = [
		{ value: 'build', title: 'Build muscle', desc: 'Strength and hypertrophy.', Icon: Dumbbell },
		{ value: 'lose', title: 'Lose fat', desc: 'Burn calories, stay lean.', Icon: Flame },
		{ value: 'general', title: 'General fitness', desc: 'Move, feel good, stay healthy.', Icon: Activity }
	];

	const depthOptions: Array<{
		value: TrackingDepth;
		title: string;
		desc: string;
		Icon: typeof Target;
	}> = [
		{ value: 'basic', title: 'Just sets', desc: 'Reps and weight only.', Icon: Target },
		{ value: 'standard', title: 'Sets + RPE', desc: 'Add perceived effort.', Icon: Gauge },
		{ value: 'full', title: 'Full programming', desc: 'Plus warmups, notes, and PR alerts.', Icon: Layers }
	];

	function selectGoal(value: OnboardingGoal) {
		goal = value;
	}

	function selectDepth(value: TrackingDepth) {
		depth = value;
	}

	function selectUnit(value: WeightUnit) {
		unit = value;
	}

	function canProceed(): boolean {
		if (step === 0) return goal !== null;
		if (step === 1) return depth !== null;
		if (step === 2) return true;
		return false;
	}

	async function next() {
		if (!canProceed()) return;
		direction = 'forward';
		if (step < 2) {
			step = (step + 1) as Step;
			return;
		}
		// Step 2 -> Done view
		await preferencesStore.update({
			goal: goal ?? undefined,
			trackingDepth: depth ?? undefined,
			weightUnit: unit,
			onboardingComplete: true
		});
		step = 3;
		// Auto-navigate after celebratory animation
		const delay = prefersReducedMotion ? 200 : 1200;
		setTimeout(() => {
			goto('/');
		}, delay);
	}

	function back() {
		if (step === 0) return;
		direction = 'backward';
		step = (step - 1) as Step;
	}

	async function skip() {
		await preferencesStore.update({ onboardingComplete: true });
		goto('/');
	}
</script>

<svelte:head>
	<title>Welcome — GymTrack</title>
</svelte:head>

<div class="min-h-screen w-full bg-bg flex flex-col">
	<div class="flex-1 flex flex-col items-stretch px-5 pt-10 pb-6 max-w-md w-full mx-auto">
		<!-- Step content -->
		<div class="flex-1 flex flex-col">
			{#if step === 0}
				<div
					class="flex-1 flex flex-col"
					class:slide-in-right={!prefersReducedMotion && direction === 'forward'}
					class:slide-in-left={!prefersReducedMotion && direction === 'backward'}
				>
					<header class="mb-6">
						<h1 class="text-2xl font-bold text-text-primary">What's your focus?</h1>
						<p class="text-text-secondary mt-1">We'll tailor what you see.</p>
					</header>
					<div class="flex flex-col gap-3">
						{#each goalOptions as opt (opt.value)}
							{@const selected = goal === opt.value}
							<button
								type="button"
								onclick={() => selectGoal(opt.value)}
								aria-pressed={selected}
								class="text-left rounded-xl border bg-surface p-4 flex items-center gap-4 transition-all duration-200 active:scale-[0.99]"
								class:option-selected={selected}
								class:option-idle={!selected}
							>
								<span
									class="flex items-center justify-center w-12 h-12 rounded-lg shrink-0"
									class:bg-accent={selected}
									class:text-bg={selected}
									class:bg-surface-elevated={!selected}
									class:text-text-primary={!selected}
								>
									<opt.Icon class="w-6 h-6" strokeWidth={2} />
								</span>
								<span class="flex-1">
									<span class="block text-text-primary font-semibold">{opt.title}</span>
									<span class="block text-sm text-text-secondary mt-0.5">{opt.desc}</span>
								</span>
							</button>
						{/each}
					</div>
				</div>
			{:else if step === 1}
				<div
					class="flex-1 flex flex-col"
					class:slide-in-right={!prefersReducedMotion && direction === 'forward'}
					class:slide-in-left={!prefersReducedMotion && direction === 'backward'}
				>
					<header class="mb-6">
						<h1 class="text-2xl font-bold text-text-primary">How much detail do you want?</h1>
						<p class="text-text-secondary mt-1">You can change this later.</p>
					</header>
					<div class="flex flex-col gap-3">
						{#each depthOptions as opt (opt.value)}
							{@const selected = depth === opt.value}
							<button
								type="button"
								onclick={() => selectDepth(opt.value)}
								aria-pressed={selected}
								class="text-left rounded-xl border bg-surface p-4 flex items-center gap-4 transition-all duration-200 active:scale-[0.99]"
								class:option-selected={selected}
								class:option-idle={!selected}
							>
								<span
									class="flex items-center justify-center w-12 h-12 rounded-lg shrink-0"
									class:bg-accent={selected}
									class:text-bg={selected}
									class:bg-surface-elevated={!selected}
									class:text-text-primary={!selected}
								>
									<opt.Icon class="w-6 h-6" strokeWidth={2} />
								</span>
								<span class="flex-1">
									<span class="block text-text-primary font-semibold">{opt.title}</span>
									<span class="block text-sm text-text-secondary mt-0.5">{opt.desc}</span>
								</span>
							</button>
						{/each}
					</div>
				</div>
			{:else if step === 2}
				<div
					class="flex-1 flex flex-col"
					class:slide-in-right={!prefersReducedMotion && direction === 'forward'}
					class:slide-in-left={!prefersReducedMotion && direction === 'backward'}
				>
					<header class="mb-6">
						<h1 class="text-2xl font-bold text-text-primary">Pick your units</h1>
					</header>
					<div class="grid grid-cols-2 gap-3">
						{#each [{ value: 'kg' as WeightUnit, label: 'Kilograms', sub: 'kg' }, { value: 'lb' as WeightUnit, label: 'Pounds', sub: 'lb' }] as opt (opt.value)}
							{@const selected = unit === opt.value}
							<button
								type="button"
								onclick={() => selectUnit(opt.value)}
								aria-pressed={selected}
								class="rounded-xl border bg-surface p-6 flex flex-col items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99] aspect-square"
								class:option-selected={selected}
								class:option-idle={!selected}
							>
								<span
									class="text-3xl font-bold"
									class:text-accent={selected}
									class:text-text-primary={!selected}
								>
									{opt.sub}
								</span>
								<span class="text-text-secondary text-sm">{opt.label}</span>
							</button>
						{/each}
					</div>
				</div>
			{:else if step === 3}
				<div class="flex-1 flex flex-col items-center justify-center">
					<div
						class="relative flex items-center justify-center"
						class:done-reveal={!prefersReducedMotion}
					>
						<div class="absolute inset-0 rounded-full bg-accent/20 blur-2xl"></div>
						<div
							class="relative w-32 h-32 rounded-full bg-accent flex items-center justify-center"
						>
							<CheckCircle2 class="w-20 h-20 text-bg" strokeWidth={2.5} />
						</div>
					</div>
					<p class="mt-6 text-text-primary font-semibold text-lg">You're all set</p>
				</div>
			{/if}
		</div>

		{#if step < 3}
			<!-- Footer: progress dots, primary action, skip -->
			<div class="mt-6 flex flex-col gap-4">
				<!-- Progress dots -->
				<div class="flex items-center justify-center gap-2" aria-label="Progress">
					{#each [0, 1, 2] as i (i)}
						<span
							class="h-1.5 rounded-full transition-all duration-200"
							class:bg-accent={i === step}
							class:w-6={i === step}
							class:bg-border={i !== step}
							class:w-1.5={i !== step}
						></span>
					{/each}
				</div>

				<!-- Action row -->
				<div class="flex items-center gap-3">
					{#if step > 0}
						<Button variant="secondary" size="md" onclick={back}>
							<ChevronLeft class="w-5 h-5" strokeWidth={2} />
							Back
						</Button>
					{/if}
					<Button
						variant="primary"
						size="md"
						fullWidth
						disabled={!canProceed()}
						onclick={next}
					>
						{step === 2 ? 'Finish' : 'Next'}
						<ChevronRight class="w-5 h-5" strokeWidth={2} />
					</Button>
				</div>

				<!-- Skip link -->
				<button
					type="button"
					onclick={skip}
					class="text-sm text-text-muted hover:text-text-secondary self-center transition-colors duration-200 py-2"
				>
					I'll set up later
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.option-selected {
		border-color: var(--color-accent, #c5ff00);
		box-shadow: 0 0 0 2px var(--color-accent, #c5ff00);
	}
	.option-idle {
		border-color: var(--color-border, rgba(255, 255, 255, 0.1));
	}
	.option-idle:hover {
		border-color: var(--color-border-active, rgba(255, 255, 255, 0.2));
	}

	@keyframes slideInRight {
		from {
			opacity: 0;
			transform: translateX(24px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
	@keyframes slideInLeft {
		from {
			opacity: 0;
			transform: translateX(-24px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
	.slide-in-right {
		animation: slideInRight 200ms ease-out;
	}
	.slide-in-left {
		animation: slideInLeft 200ms ease-out;
	}

	@keyframes doneReveal {
		0% {
			opacity: 0;
			transform: scale(0.6);
		}
		60% {
			opacity: 1;
			transform: scale(1.05);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
	.done-reveal {
		animation: doneReveal 800ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		.slide-in-right,
		.slide-in-left,
		.done-reveal {
			animation: none;
		}
	}
</style>
