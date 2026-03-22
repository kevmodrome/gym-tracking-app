/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `gymtrack-${version}`;
const PRECACHE_ASSETS = [...build, ...files];
const PRECACHE_SET = new Set(PRECACHE_ASSETS);

const VALID_MIME_TYPES: Record<string, string[]> = {
	js: ['application/javascript', 'text/javascript', 'application/x-javascript'],
	css: ['text/css'],
	svg: ['image/svg+xml'],
	png: ['image/png'],
	jpg: ['image/jpeg'],
	jpeg: ['image/jpeg'],
	webp: ['image/webp'],
	json: ['application/json']
};

function hasValidMimeType(response: Response, url: string): boolean {
	const contentType = response.headers.get('content-type');
	if (!contentType) return true;

	const pathname = new URL(url).pathname;
	const ext = pathname.split('.').pop()?.toLowerCase();

	if (!ext || !VALID_MIME_TYPES[ext]) return true;

	const mimeBase = contentType.split(';')[0].trim().toLowerCase();
	return VALID_MIME_TYPES[ext].includes(mimeBase);
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(PRECACHE_ASSETS))
			.catch((error) => console.error('Cache preloading failed:', error))
	);
	sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Cross-origin: only cache images
	if (url.origin !== sw.location.origin) {
		if (request.destination === 'image') {
			event.respondWith(
				caches.match(request).then((cached) => {
					return (
						cached ||
						fetch(request)
							.then((response) => {
								if (response && response.status === 200) {
									const responseToCache = response.clone();
									caches.open(CACHE_NAME).then((cache) => {
										cache.put(request, responseToCache);
									});
								}
								return response;
							})
							.catch(() => new Response('Image not available offline'))
					);
				})
			);
		}
		return;
	}

	// Documents: network-first with cache fallback
	if (request.destination === 'document' || request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const responseToCache = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(request, responseToCache);
					});
					return response;
				})
				.catch(() => {
					return caches.match(request).then((cached) => {
						if (cached) return cached;
						return caches.match('/') as Promise<Response>;
					});
				})
		);
		return;
	}

	// Known build/static assets: cache-first
	if (PRECACHE_SET.has(url.pathname)) {
		event.respondWith(
			caches.match(request).then((cached) => {
				if (cached && !hasValidMimeType(cached, request.url)) {
					console.warn('Invalid MIME type in cache for:', url.pathname);
					caches.open(CACHE_NAME).then((cache) => cache.delete(request));
					cached = undefined;
				}

				return (
					cached ||
					fetch(request)
						.then((response) => {
							if (!response || response.status !== 200) {
								return response;
							}

							if (!hasValidMimeType(response, request.url)) {
								console.warn('Invalid MIME type from server for:', url.pathname);
								return response;
							}

							const responseToCache = response.clone();
							caches.open(CACHE_NAME).then((cache) => {
								cache.put(request, responseToCache);
							});

							return response;
						})
						.catch((error) => {
							console.error('Fetch failed for cacheable request:', url.pathname, error);
							return caches.match(request) as Promise<Response>;
						})
				);
			})
		);
	} else {
		event.respondWith(
			fetch(request).catch((error) => {
				console.error('Fetch failed:', url.pathname, error);
				throw error;
			})
		);
	}
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheName !== CACHE_NAME) {
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
	sw.clients.claim();
});

sw.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});
