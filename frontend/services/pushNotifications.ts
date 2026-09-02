import { getCsrfToken } from '../utils/csrfService';

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray.buffer as ArrayBuffer;
}

export async function enablePushNotifications(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return false;
    }

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
        return false;
    }

    const registration = await navigator.serviceWorker.register('/tasksten-sw.js');

    const response = await fetch('/api/push/vapid-public-key', {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to get VAPID public key (${response.status})`);
    }

    const { publicKey } = await response.json();

    if (!publicKey) {
        return false;
    }

    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    });

    const csrfToken = await getCsrfToken();

    const subscribeResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
            subscription,
        }),
    });

    if (!subscribeResponse.ok) {
        const errorBody = await subscribeResponse.text();

        throw new Error(
            `Push subscription failed (${subscribeResponse.status}): ${errorBody}`
        );
    }

    return true;
}