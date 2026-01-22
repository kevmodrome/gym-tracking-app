<script lang="ts">
	import type { SessionExercise } from '$lib/types';
	import { Button, Textarea, InfoBox } from '$lib/ui';

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

	function calculateSessionVolume(): number {
		return sessionExercises.reduce((total, exercise) => {
			return total + exercise.sets.reduce((exerciseTotal, set) => {
				return exerciseTotal + (set.reps * set.weight);
			}, 0);
		}, 0);
	}

	const totalSets = $derived(sessionExercises.reduce((acc, ex) => acc + ex.sets.length, 0));
	const completedSets = $derived(sessionExercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0));
</script>

<div class="flex flex-col h-full">
	<!-- Scrollable Content Area -->
	<div class="flex-1 overflow-y-auto px-4 py-6 pb-48 md:pb-6">
		<div class="max-w-md mx-auto">
			<!-- Header -->
			<div class="text-center mb-6">
				<div class="text-4xl mb-2">🎉</div>
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
						<p class="text-text-primary font-semibold text-lg">{calculateSessionVolume().toLocaleString()} lbs</p>
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

	<!-- Fixed Bottom Action Bar - Mobile -->
	<div class="fixed bottom-20 left-0 right-0 bg-surface border-t border-border p-4 md:hidden z-40">
		<div class="max-w-md mx-auto space-y-3">
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
				onclick={onBack}
			>
				Back to Workout
			</Button>
		</div>
	</div>

	<!-- Desktop Action Buttons (inline) -->
	<div class="hidden md:block px-4 pb-6">
		<div class="max-w-md mx-auto space-y-3">
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
		</div>
	</div>
</div>
