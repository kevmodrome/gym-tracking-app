export function playTimerSound() {
	const saved = localStorage.getItem('gym-app-settings');
	const settings = saved ? JSON.parse(saved) : { soundEnabled: true };

	if (settings.soundEnabled) {
		const audio = new Audio('/alarm.mp3');
		audio.play().catch((err) => {
			console.log('Audio play failed:', err);
		});
	}
}

export function vibrateTimer() {
	const saved = localStorage.getItem('gym-app-settings');
	const settings = saved ? JSON.parse(saved) : { vibrationEnabled: true };

	if (settings.vibrationEnabled && 'vibrate' in navigator) {
		navigator.vibrate([200, 100, 200, 100, 200]);
	}
}
