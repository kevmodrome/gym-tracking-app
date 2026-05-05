import type { FoodMacros } from '$lib/types';

export interface PickedFood {
	source: 'saved' | 'livs';
	name: string;
	per100g: FoodMacros;
	savedFoodId?: string;
	livsId?: string;
}
