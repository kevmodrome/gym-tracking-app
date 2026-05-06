import { preferencesStore } from '$lib/stores/preferences.svelte';
import type { SetWeight } from '$lib/types';

export type MetricType = 'weight' | 'volume' | 'reps';

/**
 * Render a SetWeight value for display. Returns "BW" for bodyweight,
 * otherwise the numeric value followed by the user's weight unit label.
 * Pass `withUnit: false` to omit the unit suffix.
 */
export function formatSetWeight(weight: SetWeight, withUnit = true): string {
	if (weight === 'BW') return 'BW';
	const unit = withUnit ? preferencesStore.weightLabel : '';
	return withUnit ? `${weight}${unit}` : String(weight);
}

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
