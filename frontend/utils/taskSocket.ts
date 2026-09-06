import { getTaskWebSocketUrl } from '../config/paths';

type TaskSocketMessage = {
    type: string;
    payload?: any;
};

type TaskSocketListener = (data: TaskSocketMessage) => void;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<TaskSocketListener>();

function createSocket(): WebSocket | null {
    if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING)
    ) {
        return socket;
    }

    const socketUrl = getTaskWebSocketUrl();
    if (!socketUrl) return null;

    const currentSocket = new WebSocket(socketUrl);
    socket = currentSocket;

    currentSocket.onmessage = (event) => {

        try {
            const message = JSON.parse(event.data);

            listeners.forEach((listener) => {
                try {
                    listener(message);
                } catch (err) {
                    console.error('[WS] Listener error', err);
                }
            });
        } catch (err) {
            console.error('[WS] Invalid message', err);
        }
    };

    currentSocket.onclose = () => {
        if (socket === currentSocket) {
            socket = null;
        }

        if (listeners.size > 0 && reconnectTimer === null) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                createSocket();
            }, 3000);
        }
    };

    currentSocket.onerror = (error) => {
        if (listeners.size > 0) {
            console.error('[WS] Socket error', error);
        }
    };

    return currentSocket;
}

export function connectTaskSocket(
    onMessage: TaskSocketListener
): (() => void) {
    listeners.add(onMessage);

    createSocket();

    return () => {
        listeners.delete(onMessage);

        if (listeners.size === 0) {
            if (reconnectTimer !== null) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }

            if (socket?.readyState === WebSocket.OPEN) {
                socket.close();
                socket = null;
            }
        }
    };
}