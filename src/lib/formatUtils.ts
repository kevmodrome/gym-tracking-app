import { preferencesStore } from '$lib/stores/preferences.svelte';

export type MetricType = 'weight' | 'volume' | 'reps';

export function formatMuscle(muscle: string): string {
	return muscle.charAt(0).toUpperCase() + muscle.slice(1);
}

export function getMetricLabel(metric: MetricType): string {
	switch (metric) {
		case 'weight':
			return 'Weight (' + preferencesStore.weightLabel + ')';
		case 'volume':
			return 'Volume (' + preferencesStore.weightLabel + ')';
		case 'reps':
			return 'Max Reps';
	}
}

export function getMetricUnit(metric: MetricType): string {
	switch (metric) {
		case 'weight':
			return ' ' + preferencesStore.weightLabel;
		case 'volume':
			return ' ' + preferencesStore.weightLabel;
		case 'reps':
			return ' reps';
	}
}
