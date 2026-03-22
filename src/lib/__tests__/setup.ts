import 'fake-indexeddb/auto';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import '@testing-library/jest-dom';

class MockWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	url: string;
	readyState = MockWebSocket.OPEN;
	onopen: ((event: Event) => void) | null = null;
	onclose: ((event: Event) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;

	constructor(url: string | URL) {
		this.url = String(url);
		queueMicrotask(() => this.onopen?.(new Event('open')));
	}

	addEventListener() {}
	removeEventListener() {}
	send() {}

	close() {
		this.readyState = MockWebSocket.CLOSED;
		this.onclose?.(new Event('close'));
	}
}

Object.defineProperty(globalThis, 'WebSocket', {
	value: MockWebSocket,
	configurable: true,
	writable: true,
});

afterEach(() => {
	cleanup();
});
