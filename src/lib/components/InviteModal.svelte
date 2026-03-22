<script lang="ts">
	import { db } from '$lib/db';
	import { buildInviteUrl, encodeInviteCode } from '$lib/invite';
	import { Modal, Button, Textarea } from '$lib/ui';

	interface InviteModalProps {
		onclose: () => void;
	}

	let { onclose }: InviteModalProps = $props();

	let copiedTarget = $state<'link' | 'code' | null>(null);
	let exportedInvite = $derived.by(() => db.exportInvite());
	let inviteCode = $derived.by(() => encodeInviteCode(exportedInvite));

	let inviteUrl = $derived.by(() => {
		return buildInviteUrl(window.location.origin, exportedInvite);
	});

	async function copyToClipboard(value: string, target: 'link' | 'code') {
		try {
			await navigator.clipboard.writeText(value);
			copiedTarget = target;
			setTimeout(() => {
				if (copiedTarget === target) {
					copiedTarget = null;
				}
			}, 2000);
		} catch {
			const textarea = document.querySelector<HTMLTextAreaElement>(
				target === 'link' ? '#invite-url' : '#invite-code'
			);
			textarea?.select();
		}
	}
</script>

<Modal open={true} title="Connect Another Device" size="md" onclose={onclose}>
	<p class="text-sm text-text-secondary mb-4">
		Copy either the invite link or the invite code to sync another device. If an iOS
		home-screen install loses the invite URL, use the code from inside the app instead.
	</p>
	<Textarea
		id="invite-code"
		value={inviteCode}
		rows={3}
		disabled
		label="Invite Code"
		hint="Use this inside the app on the other device."
		class="mb-4"
	/>
	<Textarea
		id="invite-url"
		value={inviteUrl}
		rows={3}
		disabled
		label="Invite Link"
		hint="Open this link directly when the other device can keep the full URL."
	/>
	{#snippet footer()}
		<Button variant="secondary" onclick={onclose}>Close</Button>
		<Button variant="secondary" onclick={() => copyToClipboard(inviteCode, 'code')}>
			{copiedTarget === 'code' ? 'Code Copied!' : 'Copy Code'}
		</Button>
		<Button onclick={() => copyToClipboard(inviteUrl, 'link')}>
			{copiedTarget === 'link' ? 'Link Copied!' : 'Copy Link'}
		</Button>
	{/snippet}
</Modal>
