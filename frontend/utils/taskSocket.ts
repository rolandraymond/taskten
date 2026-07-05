import { getTaskWebSocketUrl } from '../config/paths';

let socket: WebSocket | null = null;

export function connectTaskSocket(onMessage: (data: any) => void): WebSocket | null {
    if (socket) return socket;

    const socketUrl = getTaskWebSocketUrl();
    if (!socketUrl) return null;

    socket = new WebSocket(socketUrl);

    socket.onmessage = (event) => {
        try {
            onMessage(JSON.parse(event.data));
        } catch (err) {
            console.error('[WS] Invalid message', err);
        }
    };

    socket.onclose = () => {
        socket = null;
        setTimeout(() => connectTaskSocket(onMessage), 3000);
    };

    return socket;
}