export function toDateString(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function todayString(): string {
	return toDateString(new Date());
}

export function addDays(dateStr: string, delta: number): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	const dt = new Date(y, m - 1, d);
	dt.setDate(dt.getDate() + delta);
	return toDateString(dt);
}

export function formatDateLabel(dateStr: string): string {
	const today = todayString();
	if (dateStr === today) return 'Today';
	if (dateStr === addDays(today, -1)) return 'Yesterday';
	const [y, m, d] = dateStr.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	});
}
