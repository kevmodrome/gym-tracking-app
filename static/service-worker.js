const CACHE_NAME = 'gymtrack-v1';
const STATIC_ASSETS = [
	'/',
	'/manifest.webmanifest',
	'/icon-192x192.svg',
	'/icon-512x512.svg'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(STATIC_ASSETS);
		})
	);
	self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	event.respondWith(
		caches.match(event.request).then((response) => {
			return response || fetch(event.request).then((fetchResponse) => {
				if (
					!fetchResponse ||
					fetchResponse.status !== 200 ||
					fetchResponse.type !== 'basic'
				) {
					return fetchResponse;
				}

				const responseToCache = fetchResponse.clone();
				caches.open(CACHE_NAME).then((cache) => {
					cache.put(event.request, responseToCache);
				});

				return fetchResponse;
			}).catch((error) => {
				console.error('Fetch failed:', error);
				return caches.match(event.request);
			});
		})
	);
});

self.addEventListener('activate', (event) => {
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
	self.clients.claim();
});

if ('sync' in self.registration) {
	self.addEventListener('sync', (event) => {
		if (event.tag === 'sync-data') {
			event.waitUntil(
				self.clients.matchAll().then((clients) => {
					if (clients.length > 0) {
						clients[0].postMessage({ type: 'SYNC_TRIGGERED' });
					}
				})
			);
		}
	});
}

self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'REGISTER_SYNC') {
		if ('sync' in self.registration) {
			self.registration.sync.register('sync-data').catch((error) => {
				console.error('Sync registration failed:', error);
			});
		}
	}
});
