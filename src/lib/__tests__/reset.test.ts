import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearAppLocalState,
	clearPendingReset,
	getInviteDbName,
	getPendingResetDbName,
	markPendingReset,
} from '$lib/reset';

describe('reset helpers', () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
	});

	it('uses the invite db name when present', () => {
		localStorage.setItem(
			'gym-app-invite',
			JSON.stringify({ dbName: 'custom-gym-db', relays: [], epochKeys: [] })
		);

		expect(getInviteDbName()).toBe('custom-gym-db');
	});

	it('falls back to the default db name when the invite is invalid', () => {
		localStorage.setItem('gym-app-invite', '{broken json');

		expect(getInviteDbName()).toBe('gym-recording-app');
	});

	it('clears app-owned local storage keys but preserves unrelated keys', () => {
		localStorage.setItem('gym-app-settings', '1');
		localStorage.setItem('gym-progress-exercise', '2');
		localStorage.setItem('progress-selected-exercise', '3');
		localStorage.setItem('pwa-install-dismissed', '4');
		localStorage.setItem('unrelated-key', 'keep');

		clearAppLocalState();

		expect(localStorage.getItem('gym-app-settings')).toBeNull();
		expect(localStorage.getItem('gym-progress-exercise')).toBeNull();
		expect(localStorage.getItem('progress-selected-exercise')).toBeNull();
		expect(localStorage.getItem('pwa-install-dismissed')).toBeNull();
		expect(localStorage.getItem('unrelated-key')).toBe('keep');
	});

	it('tracks a pending reset in session storage', () => {
		markPendingReset('gym-recording-app');
		expect(getPendingResetDbName()).toBe('gym-recording-app');

		clearPendingReset();
		expect(getPendingResetDbName()).toBeNull();
	});
});
