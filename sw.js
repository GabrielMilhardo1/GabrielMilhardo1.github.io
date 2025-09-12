// Service Worker for Gabriel Milhardo Portfolio
const CACHE_NAME = 'gabriel-portfolio-v1.0.0';
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/assets/site.webmanifest',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap',
    'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.15.1/devicon.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://unpkg.com/scrollreveal',
    'https://cdn.jsdelivr.net/npm/typed.js@2.0.12'
];

const DYNAMIC_CACHE_URLS = [
    'https://images.unsplash.com/',
    'https://flagcdn.com/'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Install Event');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching Files');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activate Event');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing Old Cache');
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Handle different types of requests
    if (event.request.destination === 'document') {
        // HTML documents - network first, fallback to cache
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone response to cache
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then((response) => {
                            return response || caches.match('/index.html');
                        });
                })
        );
    } else if (event.request.destination === 'image') {
        // Images - cache first, fallback to network
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request)
                        .then((response) => {
                            // Cache successful image responses
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                            }
                            return response;
                        });
                })
        );
    } else {
        // Other resources - cache first, fallback to network
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    return response || fetch(event.request)
                        .then((response) => {
                            // Cache successful responses
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                            }
                            return response;
                        });
                })
        );
    }
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
    if (event.tag === 'contact-form-sync') {
        event.waitUntil(
            // Handle offline form submissions when connection is restored
            handleOfflineFormSubmissions()
        );
    }
});

// Push notifications (for future use)
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New update available!',
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'View Portfolio',
                icon: '/assets/icon-192.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/assets/icon-192.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Gabriel Milhardo Portfolio', options)
    );
});

// Handle offline form submissions
async function handleOfflineFormSubmissions() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    const offlineSubmissions = requests.filter(request => 
        request.url.includes('offline-form-submission')
    );
    
    for (const request of offlineSubmissions) {
        try {
            const response = await cache.match(request);
            const formData = await response.json();
            
            // Attempt to submit the form data
            await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            // Remove from cache after successful submission
            await cache.delete(request);
        } catch (error) {
            console.log('Failed to sync form submission:', error);
        }
    }
}