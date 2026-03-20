<script lang="ts">
	import { encodeInvite } from 'tablinum/svelte';
	import { db } from '$lib/db';
	import { Modal, Button, Textarea } from '$lib/ui';

	interface InviteModalProps {
		onclose: () => void;
	}

	let { onclose }: InviteModalProps = $props();

	let copied = $state(false);

	let inviteUrl = $derived.by(() => {
		const encoded = encodeInvite(db.exportInvite());
		const url = new URL(window.location.origin);
		url.searchParams.set('invite', encoded);
		return url.toString();
	});

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(inviteUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			const textarea = document.querySelector<HTMLTextAreaElement>('#invite-url');
			textarea?.select();
		}
	}
</script>

<Modal open={true} title="Connect Another Device" size="md" onclose={onclose}>
	<p class="text-sm text-text-secondary mb-4">
		Copy this link and open it on your other device to sync your data.
	</p>
	<Textarea
		id="invite-url"
		value={inviteUrl}
		rows={3}
		disabled
		label="Invite Link"
	/>
	{#snippet footer()}
		<Button variant="secondary" onclick={onclose}>Close</Button>
		<Button onclick={copyToClipboard}>
			{copied ? 'Copied!' : 'Copy Link'}
		</Button>
	{/snippet}
</Modal>
