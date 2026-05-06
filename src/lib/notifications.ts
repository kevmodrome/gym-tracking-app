import { preferencesStore } from '$lib/stores/preferences.svelte';

export function playTimerSound() {
	if (preferencesStore.soundEnabled) {
		const audio = new Audio('/alarm.mp3');
		audio.play().catch((err) => {
			console.log('Audio play failed:', err);
		});
	}
}

export function vibrateTimer() {
	if (preferencesStore.vibrationEnabled && 'vibrate' in navigator) {
		navigator.vibrate([200, 100, 200, 100, 200]);
	}
}
