'use strict';

const WebSocket = require('ws');
const taskEvents = require('../modules/tasks/taskEvents');

function setupTaskSocket(server) {
    const wss = new WebSocket.Server({
        server,
        path: '/ws/tasks',
    });

    const broadcast = (payload) => {
        const message = JSON.stringify(payload);

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    };

    taskEvents.on('task.completed', (payload) => {
        broadcast({
            type: 'task.completed',
            payload,
        });
    });

    taskEvents.on('task.updated', (payload) => {
        broadcast({
            type: 'task.updated',
            payload,
        });
    });

    console.log('[WebSocket] Task socket ready on /ws/tasks');

    return wss;
}

module.exports = setupTaskSocket;