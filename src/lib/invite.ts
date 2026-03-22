import { decodeInvite, encodeInvite } from 'tablinum/svelte';
import type { Invite } from 'tablinum/svelte';

export const INVITE_STORAGE_KEY = 'gym-app-invite';
export const JOINED_VIA_INVITE_KEY = 'gym-app-joined-via-invite';
const INVITE_QUERY_PARAM = 'invite';
const INVITE_URL_BASE = 'https://invite.invalid';

function extractInviteCode(rawInput: string): string {
	const trimmed = rawInput.trim();
	if (!trimmed) {
		throw new Error('Invite code is required');
	}

	if (trimmed.includes(`${INVITE_QUERY_PARAM}=`)) {
		try {
			const url = new URL(trimmed, INVITE_URL_BASE);
			const invite = url.searchParams.get(INVITE_QUERY_PARAM);
			if (invite) {
				return invite.replace(/\s+/g, '');
			}
		} catch {
			// Fall back to treating the value as a raw invite code.
		}
	}

	return trimmed.replace(/\s+/g, '');
}

export function decodeInviteInput(rawInput: string): Invite {
	return decodeInvite(extractInviteCode(rawInput));
}

export function bootstrapInvite(invite: Invite): void {
	localStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify(invite));
	localStorage.setItem(JOINED_VIA_INVITE_KEY, 'true');
}

export function bootstrapInviteInput(rawInput: string): Invite {
	const invite = decodeInviteInput(rawInput);
	bootstrapInvite(invite);
	return invite;
}

export function consumeInviteFromUrl(url: URL): boolean {
	const inviteParam = url.searchParams.get(INVITE_QUERY_PARAM);
	if (!inviteParam) {
		return false;
	}

	bootstrapInviteInput(inviteParam);
	return true;
}

export function encodeInviteCode(invite: Invite): string {
	return encodeInvite(invite);
}

export function buildInviteUrl(origin: string, invite: Invite): string {
	const url = new URL(origin);
	url.searchParams.set(INVITE_QUERY_PARAM, encodeInviteCode(invite));
	return url.toString();
}
