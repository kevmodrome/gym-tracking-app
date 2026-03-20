export type DateFilter = 'week' | 'month' | 'year' | 'custom';

export function getDateRange(
	filter: DateFilter,
	customStartDate?: string,
	customEndDate?: string
): { startDate: Date; endDate: Date } {
	const now = new Date();

	let startDate: Date;
	switch (filter) {
		case 'week':
			startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
			break;
		case 'month':
			startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
			break;
		case 'year':
			startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
			break;
		case 'custom':
			startDate = customStartDate ? new Date(customStartDate) : new Date(0);
			break;
		default:
			startDate = new Date(0);
	}

	const endDate = filter === 'custom' && customEndDate ? new Date(customEndDate) : now;

	return { startDate, endDate };
}
