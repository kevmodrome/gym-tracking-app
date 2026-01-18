import type { WeightUnit } from '$lib/types';

/**
 * Format a weight value with its unit suffix.
 * This is display-only - the stored value is not converted.
 */
export function formatWeightWithUnit(value: number, unit: WeightUnit): string {
	return `${value} ${unit}`;
}

/**
 * Format a weight value with unit, using 'k' suffix for thousands.
 */
export function formatVolumeWithUnit(value: number, unit: WeightUnit): string {
	if (value >= 1000) {
		return `${(value / 1000).toFixed(1)}k ${unit}`;
	}
	return `${value} ${unit}`;
}

/**
 * Get the label text for weight input fields.
 */
export function getWeightLabel(unit: WeightUnit): string {
	return `Weight (${unit})`;
}

/**
 * Get the unit suffix string.
 */
export function getWeightUnitSuffix(unit: WeightUnit): string {
	return unit;
}
