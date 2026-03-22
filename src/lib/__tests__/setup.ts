import 'fake-indexeddb/auto';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import '@testing-library/jest-dom';

afterEach(() => {
	cleanup();
});
