import { describe, it, expect } from 'vitest';
import { toDateString, todayString, addDays, formatDateLabel } from './dates';

describe('toDateString', () => {
	it('formats local date as YYYY-MM-DD', () => {
		const d = new Date(2026, 4, 5, 14, 30); // May 5, 2026 local
		expect(toDateString(d)).toBe('2026-05-05');
	});

	it('handles single-digit months and days with zero-padding', () => {
		expect(toDateString(new Date(2026, 0, 9))).toBe('2026-01-09');
	});
});

describe('todayString', () => {
	it('returns a YYYY-MM-DD string', () => {
		expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('addDays', () => {
	it('adds positive days', () => {
		expect(addDays('2026-05-05', 3)).toBe('2026-05-08');
	});
	it('subtracts with negative delta', () => {
		expect(addDays('2026-05-05', -1)).toBe('2026-05-04');
	});
	it('crosses month boundaries', () => {
		expect(addDays('2026-05-31', 1)).toBe('2026-06-01');
	});
});

describe('formatDateLabel', () => {
	it('renders "Today" for today', () => {
		expect(formatDateLabel(todayString())).toBe('Today');
	});
	it('renders "Yesterday" for one day before', () => {
		expect(formatDateLabel(addDays(todayString(), -1))).toBe('Yesterday');
	});
	it('renders longer dates as locale-formatted', () => {
		const label = formatDateLabel('2024-01-15');
		expect(label).toMatch(/Jan/);
	});
});
