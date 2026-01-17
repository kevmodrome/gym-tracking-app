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
});
