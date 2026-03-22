import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('tablinum/svelte', () => ({
	decodeInvite: vi.fn((value: string) => {
		if (value === 'valid-code') {
			return {
				dbName: 'shared-db',
				relays: ['wss://relay.tablinum.dev/'],
				epochKeys: ['epoch-key'],
			};
		}

		throw new Error('Invalid invite');
	}),
	encodeInvite: vi.fn((invite: { dbName: string }) => `encoded-${invite.dbName}`),
}));

import {
	bootstrapInviteInput,
	buildInviteUrl,
	consumeInviteFromUrl,
	INVITE_STORAGE_KEY,
	JOINED_VIA_INVITE_KEY,
} from '$lib/invite';

describe('invite helpers', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('stores a direct invite code for bootstrap', () => {
		bootstrapInviteInput('valid-code');

		expect(localStorage.getItem(INVITE_STORAGE_KEY)).toBe(
			JSON.stringify({
				dbName: 'shared-db',
				relays: ['wss://relay.tablinum.dev/'],
				epochKeys: ['epoch-key'],
			})
		);
		expect(localStorage.getItem(JOINED_VIA_INVITE_KEY)).toBe('true');
	});

	it('extracts an invite code from a pasted invite URL', () => {
		bootstrapInviteInput('https://gymtrack.app/?invite=valid-code');

		expect(localStorage.getItem(INVITE_STORAGE_KEY)).toContain('shared-db');
		expect(localStorage.getItem(JOINED_VIA_INVITE_KEY)).toBe('true');
	});

	it('consumes invite params from a url object', () => {
		const url = new URL('https://gymtrack.app/settings?invite=valid-code');

		expect(consumeInviteFromUrl(url)).toBe(true);
		expect(localStorage.getItem(INVITE_STORAGE_KEY)).toContain('shared-db');
	});

	it('returns false when a url has no invite param', () => {
		const url = new URL('https://gymtrack.app/settings');

		expect(consumeInviteFromUrl(url)).toBe(false);
		expect(localStorage.getItem(INVITE_STORAGE_KEY)).toBeNull();
	});

	it('builds invite urls with the encoded invite code', () => {
		const inviteUrl = buildInviteUrl(
			'https://gymtrack.app',
			{
				dbName: 'shared-db',
				relays: ['wss://relay.tablinum.dev/'],
				epochKeys: ['epoch-key'],
			} as unknown as Parameters<typeof buildInviteUrl>[1]
		);

		expect(inviteUrl).toBe('https://gymtrack.app/?invite=encoded-shared-db');
	});
});
