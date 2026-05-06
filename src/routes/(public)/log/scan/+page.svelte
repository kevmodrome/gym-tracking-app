<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, PageHeader } from '$lib/ui';
	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
	import { findFoodByBarcode } from '$lib/nutrition/db';
	import { fetchOffProduct } from '$lib/nutrition/off';
	import { toastStore } from '$lib/stores/toast.svelte';

	const HANDOFF_KEY = 'gym-app-scan-handoff';

	let busy = $state(false);

	async function onBarcode(barcode: string) {
		if (busy) return;
		busy = true;

		const saved = await findFoodByBarcode(barcode);
		if (saved) {
			sessionStorage.setItem(
				HANDOFF_KEY,
				JSON.stringify({ kind: 'saved', foodId: saved.id, name: saved.name, per100g: saved.per100g }),
			);
			goto('/log');
			return;
		}

		try {
			const off = await fetchOffProduct(barcode);
			if (off) {
				sessionStorage.setItem(
					HANDOFF_KEY,
					JSON.stringify({ kind: 'off', barcode, name: off.name, brand: off.brand, per100g: off.per100g }),
				);
				goto('/log');
				return;
			}
			sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ kind: 'manual', barcode }));
			toastStore.showError('Product not found — enter it manually.');
			goto('/log');
		} catch {
			sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ kind: 'manual', barcode }));
			toastStore.showError('Offline / lookup failed — enter it manually.');
			goto('/log');
		}
	}
</script>

<div class="min-h-screen bg-bg p-4 md:p-8">
	<div class="max-w-md mx-auto">
		<PageHeader title="Scan barcode" />
		<div class="mb-3 flex justify-end">
			<Button variant="ghost" onclick={() => goto('/log')}>Cancel</Button>
		</div>
		<BarcodeScanner onScan={onBarcode} />
		<p class="text-center text-xs text-text-secondary mt-3">
			Point at a product barcode. Results auto-cache locally.
		</p>
	</div>
</div>
