// DreamFlix â€” Service Worker for Push Notifications
// Built for Gold and Diamant premium experience

self.addEventListener('push', function(event) {
    let data = { 
        title: "DreamFlix", 
        body: "Un nouvel épisode est disponible !", 
        url: 'index.html' 
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: 'img/logo_dreamflix.png',
        badge: 'img/logo_dreamflix.png',
        vibrate: [200, 100, 200],
        data: { url: data.url },
        actions: [
            { action: 'open', title: 'Voir le contenu' }
        ],
        tag: 'dreamflix-push',
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const urlToOpen = event.notification.data.url || 'index.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Support for client-triggered alerts (via nav.js)
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, url } = event.data;
        const options = {
            body: body,
            icon: 'img/logo_dreamflix.png',
            badge: 'img/logo_dreamflix.png',
            vibrate: [200, 100, 200],
            data: { url: url },
            tag: 'dreamflix-admin-msg',
            renotify: true
        };
        event.waitUntil(self.registration.showNotification(title, options));
    }
});
