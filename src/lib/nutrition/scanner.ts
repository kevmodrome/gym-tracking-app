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

export async function startScanner(
	video: HTMLVideoElement,
	onResult: (r: ScanResult) => void,
): Promise<ScanController> {
	const stream = await navigator.mediaDevices.getUserMedia({
		video: { facingMode: 'environment' },
		audio: false,
	});
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
