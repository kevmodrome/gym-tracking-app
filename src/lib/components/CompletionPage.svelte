<script lang="ts">
	import type { SessionExercise } from '$lib/types';
	import { calculateSessionVolume } from '$lib/dashboardMetrics';
	import { Button, Textarea, InfoBox } from '$lib/ui';
	import { preferencesStore } from '$lib/stores/preferences.svelte';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import { PartyPopper } from 'lucide-svelte';

	interface CompletionPageProps {
		sessionDuration: number;
		sessionExercises: SessionExercise[];
		sessionNotes: string;
		onNotesChange: (notes: string) => void;
		onBack: () => void;
		onSave: () => void;
	}

	let {
		sessionDuration,
		sessionExercises,
		sessionNotes,
		onNotesChange,
		onBack,
		onSave
	}: CompletionPageProps = $props();

	const totalSets = $derived(sessionExercises.reduce((acc, ex) => acc + ex.sets.length, 0));
	const completedSets = $derived(sessionExercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0));
</script>

<div class="flex flex-col h-full">
	<!-- Scrollable Content Area -->
	<div class="flex-1 overflow-y-auto px-4 py-6 pb-48 md:pb-6">
		<div class="max-w-md mx-auto">
			<!-- Header -->
			<div class="text-center mb-6">
				<PartyPopper class="w-10 h-10 mx-auto mb-2 text-accent" />
				<h1 class="text-2xl font-bold font-display text-text-primary">
					Workout Complete!
				</h1>
			</div>

			<!-- Summary Card -->
			<InfoBox type="info" class="mb-6">
				<h3 class="font-semibold mb-3 text-lg">Summary</h3>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<p class="text-text-muted text-xs uppercase tracking-wide">Duration</p>
						<p class="text-text-primary font-semibold text-lg">{sessionDuration} min</p>
					</div>
					<div>
						<p class="text-text-muted text-xs uppercase tracking-wide">Exercises</p>
						<p class="text-text-primary font-semibold text-lg">{sessionExercises.length}</p>
					</div>
					<div>
						<p class="text-text-muted text-xs uppercase tracking-wide">Sets</p>
						<p class="text-text-primary font-semibold text-lg">{completedSets} / {totalSets}</p>
					</div>
					<div>
						<p class="text-text-muted text-xs uppercase tracking-wide">Volume</p>
						<p class="text-text-primary font-semibold text-lg">{calculateSessionVolume({ exercises: sessionExercises }).toLocaleString()} {preferencesStore.weightLabel}</p>
					</div>
				</div>
			</InfoBox>

			<!-- Notes -->
			<div class="mb-6">
				<Textarea
					label="Notes (optional)"
					value={sessionNotes}
					oninput={(e: Event) => onNotesChange((e.target as HTMLTextAreaElement).value)}
					placeholder="How did your workout go?"
					rows={3}
				/>
			</div>
		</div>
	</div>

	<ActionBar>
		<Button
			variant="success"
			fullWidth
			size="lg"
			onclick={onSave}
		>
			Save Workout
		</Button>
		<Button
			variant="ghost"
			fullWidth
			size="lg"
			onclick={onBack}
		>
			Back to Workout
		</Button>
	</ActionBar>
</div>
