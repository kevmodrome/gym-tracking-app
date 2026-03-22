<script lang="ts">
	import { bootstrapInviteInput } from '$lib/invite';
	import { Button, Modal, Textarea } from '$lib/ui';

	interface JoinInviteModalProps {
		onclose: () => void;
	}

	let { onclose }: JoinInviteModalProps = $props();

	let inviteInput = $state('');
	let inviteError = $state('');
	let isJoining = $state(false);

	function handleInput() {
		inviteError = '';
	}

	function joinWithInvite() {
		inviteError = '';
		try {
			bootstrapInviteInput(inviteInput);
			isJoining = true;
			window.location.assign('/');
		} catch {
			inviteError = 'Enter a valid invite code or invite link.';
		}
	}
</script>

<Modal open={true} title="Join with Invite Code" size="md" onclose={onclose}>
	<div class="space-y-4">
		<p class="text-sm text-text-secondary">
			Paste the invite code or the full invite link from your other device. This is the
			reliable fallback when iOS home-screen installs do not preserve the shared invite URL.
		</p>
		<Textarea
			id="join-invite-input"
			bind:value={inviteInput}
			rows={4}
			label="Invite Code or Link"
			placeholder="Paste the invite code or invite link"
			hint="The app will reload into the shared database after the invite is accepted."
			oninput={handleInput}
		/>
		{#if inviteError}
			<p class="text-sm text-danger">{inviteError}</p>
		{/if}
	</div>
	{#snippet footer()}
		<Button variant="secondary" onclick={onclose}>Cancel</Button>
		<Button
			onclick={joinWithInvite}
			disabled={isJoining || inviteInput.trim().length === 0}
			loading={isJoining}
		>
			Join Device
		</Button>
	{/snippet}
</Modal>
