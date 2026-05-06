import { playTimerSound, vibrateTimer } from './notifications';

export class Timer {
	timeLeft = $state(0);
	isRunning = $state(false);
	isPaused = $state(false);
	private intervalId: number | null = null;
	private _duration = $state(0);
	private onComplete?: () => void;

	formattedTime = $derived.by(() => {
		const minutes = Math.floor(this.timeLeft / 60);
		const seconds = this.timeLeft % 60;
		return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	});

	progressPercent = $derived.by(() => {
		return ((this._duration - this.timeLeft) / this._duration) * 100;
	});

	constructor(duration: number, onComplete?: () => void) {
		this._duration = duration;
		this.timeLeft = duration;
		this.onComplete = onComplete;
	}

	setDuration(duration: number) {
		this._duration = duration;
		this.timeLeft = duration;
	}

	start() {
		if (this.isRunning) return;
		this.isRunning = true;
		this.isPaused = false;

		this.intervalId = window.setInterval(() => {
			if (this.timeLeft > 0) {
				this.timeLeft--;
			} else {
				this.end();
			}
		}, 1000);
	}

	pause() {
		if (!this.isRunning) return;
		this.isRunning = false;
		this.isPaused = true;
		this.clearInterval();
	}

	resume() {
		if (!this.isPaused) return;
		this.start();
	}

	skip(callback?: () => void) {
		this.clearInterval();
		this.isRunning = false;
		this.isPaused = false;
		callback?.();
	}

	adjustDuration(amount: number) {
		this.timeLeft = Math.max(10, Math.min(300, this.timeLeft + amount));
	}

	reset() {
		this.clearInterval();
		this.timeLeft = this._duration;
		this.isRunning = false;
		this.isPaused = false;
	}

	destroy() {
		this.clearInterval();
	}

	private end() {
		this.clearInterval();
		playTimerSound();
		vibrateTimer();
		this.onComplete?.();
	}

	private clearInterval() {
		if (this.intervalId) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}
}
