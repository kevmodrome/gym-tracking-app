export interface ScanController {
	stop: () => void;
}

export type ScanResult = { barcode: string; format?: string };

declare global {
	interface Window {
		BarcodeDetector?: {
			new (options?: { formats?: string[] }): {
				detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string; format: string }>>;
			};
		};
	}
}

export function isBarcodeDetectorSupported(): boolean {
	return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function';
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

async function startWithBarcodeDetector(
	video: HTMLVideoElement,
	onResult: (r: ScanResult) => void,
): Promise<ScanController> {
	const Detector = window.BarcodeDetector!;
	const detector = new Detector({ formats: FORMATS });
	let stopped = false;
	const tick = async () => {
		if (stopped) return;
		try {
			const results = await detector.detect(video);
			if (results.length > 0) {
				onResult({ barcode: results[0].rawValue, format: results[0].format });
				return;
			}
		} catch {
			// ignore frame errors
		}
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
	return { stop: () => { stopped = true; } };
}

async function startWithZxing(
	video: HTMLVideoElement,
	onResult: (r: ScanResult) => void,
): Promise<ScanController> {
	const { BrowserMultiFormatReader } = await import('@zxing/browser');
	const reader = new BrowserMultiFormatReader();
	const controls = await reader.decodeFromVideoElement(video, (result) => {
		if (result) {
			onResult({ barcode: result.getText(), format: 'zxing' });
		}
	});
	return { stop: () => controls.stop() };
}

export class ScannerError extends Error {
	constructor(
		message: string,
		public readonly reason: 'insecure-context' | 'no-camera-api' | 'permission' | 'no-camera' | 'unknown',
	) {
		super(message);
		this.name = 'ScannerError';
	}
}

export async function startScanner(
	video: HTMLVideoElement,
	onResult: (r: ScanResult) => void,
): Promise<ScanController> {
	if (typeof window !== 'undefined' && window.isSecureContext === false) {
		throw new ScannerError(
			'Camera access requires HTTPS. Open the deployed app, or run the dev server over HTTPS.',
			'insecure-context',
		);
	}
	if (!navigator?.mediaDevices?.getUserMedia) {
		throw new ScannerError(
			"This browser doesn't expose camera access. Try Safari on iOS, Chrome on Android, or a desktop browser.",
			'no-camera-api',
		);
	}

	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({
			// Prefer the rear camera when available, but don't require it —
			// desktop webcams and front-facing-only devices still work.
			video: { facingMode: { ideal: 'environment' } },
			audio: false,
		});
	} catch (e) {
		const err = e as DOMException;
		if (err?.name === 'NotAllowedError') {
			throw new ScannerError('Camera permission denied. Enable it in your browser settings.', 'permission');
		}
		if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
			throw new ScannerError('No camera found on this device.', 'no-camera');
		}
		throw new ScannerError(err?.message || 'Could not start the camera.', 'unknown');
	}

	video.srcObject = stream;
	await video.play();

	const inner = isBarcodeDetectorSupported()
		? await startWithBarcodeDetector(video, onResult)
		: await startWithZxing(video, onResult);

	return {
		stop: () => {
			inner.stop();
			stream.getTracks().forEach((t) => t.stop());
		},
	};
}
