const CACHE_VERSION = 'v2';
const CACHE_NAME = `gymtrack-${CACHE_VERSION}`;

const STATIC_ASSETS = [
	'/',
	'/manifest.webmanifest',
	'/icon-192x192.svg',
	'/icon-512x512.svg',
    '/favicon.svg'
];

const CACHEABLE_PATTERNS = [
    /^\/_app\/immutable\//,
    /^\/_app\/version\.json/,
    /\.css$/,
    /\.js$/,
    /\.svg$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.webp$/
];

function isCacheableRequest(request) {
    const url = new URL(request.url);
    
    if (!request.url.startsWith(self.origin)) {
        return false;
    }
    
    if (url.pathname.includes('/api/')) {
        return false;
    }
    
    return CACHEABLE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(STATIC_ASSETS);
		}).catch((error) => {
			console.error('Cache preloading failed:', error);
		})
	);
	self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    if (url.origin !== self.origin) {
        if (request.destination === 'image') {
            event.respondWith(
                caches.match(request).then((cached) => {
                    return cached || fetch(request).then((response) => {
                        if (response && response.status === 200) {
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseToCache);
                            });
                        }
                        return response;
                    }).catch(() => new Response('Image not available offline'));
                })
            );
        }
        return;
    }
    
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
                        return caches.match('/');
                    });
                })
        );
        return;
    }
    
    if (isCacheableRequest(request)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                return cached || fetch(request).then((response) => {
                    if (!response || response.status !== 200) {
                        return response;
                    }
                    
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                    
                    return response;
                }).catch((error) => {
                    console.error('Fetch failed for cacheable request:', url.pathname, error);
                    return caches.match(request);
                });
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
