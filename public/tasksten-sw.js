self.addEventListener('push', (event) => {
    const payload = event.data ? event.data.json() : {};
    event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
            client.postMessage({
                type: 'TASKSTEN_NOTIFICATION_SOUND',
                payload,
            });
        });
    })
);

    const title = payload.title || 'Tasksten7';
    const options = {
        body: payload.body || '',
        data: {
            url: payload.url || '/',
            notification_uid: payload.notification_uid,
            type: payload.type,
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    client.navigate(url);
                    return;
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});