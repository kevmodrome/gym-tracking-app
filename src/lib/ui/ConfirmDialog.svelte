<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import InfoBox from './InfoBox.svelte';

	type ConfirmVariant = 'danger' | 'warning' | 'info';

	interface ConfirmDialogProps {
		open: boolean;
		title: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		confirmVariant?: ConfirmVariant;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let {
		open = false,
		title,
		message,
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		confirmVariant = 'danger',
		onconfirm,
		oncancel
	}: ConfirmDialogProps = $props();

	const variantToInfoBoxType = {
		danger: 'error',
		warning: 'warning',
		info: 'info'
	} as const;

	const confirmButtonVariant = confirmVariant === 'danger' ? 'danger' : confirmVariant === 'warning' ? 'ghost' : 'primary';
</script>

<Modal {open} {title} size="sm" onclose={oncancel}>
	{#snippet children()}
		<div class="space-y-4">
			<InfoBox type={variantToInfoBoxType[confirmVariant]}>
				{message}
			</InfoBox>
		</div>
	{/snippet}
	{#snippet footer()}
		<div class="flex gap-3 w-full">
			<Button variant="secondary" onclick={oncancel} class="flex-1">
				{cancelText}
			</Button>
			<Button variant={confirmButtonVariant} onclick={onconfirm} class="flex-1">
				{confirmText}
			</Button>
		</div>
	{/snippet}
</Modal>
