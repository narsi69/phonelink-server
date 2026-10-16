const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve static frontend files (index.html)
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Active sessions memory: { roomId: { hostSocketId, pin, viewerSocketId } }
const activeRooms = {};

io.on('connection', (socket) => {
    console.log(`[Socket Connected] ID: ${socket.id}`);

    // 1. Phone App (Host) Device ID aur Fixed PIN register karta hai
    socket.on('register-host', (data) => {
        let payload = data;
        if (typeof data === 'string') {
            try { payload = JSON.parse(data); } catch (e) { payload = {}; }
        }

        const roomId = payload ? payload.roomId : null;
        const pin = payload ? payload.pin : null;

        if (!roomId || !pin) {
            console.log(`[Host Registration Rejected] Missing roomId or pin. Received:`, data);
            return;
        }

        activeRooms[roomId] = {
            hostSocketId: socket.id,
            pin: String(pin).trim(),
            viewerSocketId: null
        };
        socket.roomId = roomId;

        console.log(`=========================================`);
        console.log(`[Host Online] Device ID: ${roomId} | PIN: ${pin}`);
        console.log(`=========================================`);

        socket.emit('host-registered', { success: true, roomId: roomId });
    });

    // 2. Browser (Viewer) ID aur PIN ke sath authenticate hota hai
    socket.on('join-viewer', (data) => {
        let payload = data;
        if (typeof data === 'string') {
            try { payload = JSON.parse(data); } catch (e) { payload = {}; }
        }

        const roomId = payload ? payload.roomId : null;
        const pin = payload ? payload.pin : null;
        const targetRoom = activeRooms[roomId];

        if (!targetRoom) {
            console.log(`[Viewer Failed] Room ${roomId} is offline`);
            return socket.emit('auth-error', { 
                message: 'Device offline hai ya galat Device ID hai.' 
            });
        }

        if (targetRoom.pin !== String(pin).trim()) {
            console.log(`[Viewer Failed] Room ${roomId} PIN mismatch. Sent: ${pin}, Expected: ${targetRoom.pin}`);
            return socket.emit('auth-error', { 
                message: 'Galat Security PIN! Connection reject ho gaya.' 
            });
        }

        targetRoom.viewerSocketId = socket.id;
        socket.roomId = roomId;

        console.log(`[Access Granted] Viewer ${socket.id} paired with Host ${roomId}`);

        socket.emit('auth-success', { roomId: roomId });
        io.to(targetRoom.hostSocketId).emit('viewer-ready');
    });

    // 3. WebRTC Signaling Relays
    socket.on('offer', (data) => {
        const targetRoom = activeRooms[socket.roomId];
        if (targetRoom && targetRoom.viewerSocketId) {
            io.to(targetRoom.viewerSocketId).emit('offer', data);
        }
    });

    socket.on('answer', (data) => {
        const targetRoom = activeRooms[socket.roomId];
        if (targetRoom && targetRoom.hostSocketId) {
            io.to(targetRoom.hostSocketId).emit('answer', data);
        }
    });

    socket.on('ice-candidate', (data) => {
        const targetRoom = activeRooms[socket.roomId];
        if (!targetRoom) return;

        const targetSocketId = (socket.id === targetRoom.hostSocketId) 
            ? targetRoom.viewerSocketId 
            : targetRoom.hostSocketId;

        if (targetSocketId) {
            io.to(targetSocketId).emit('ice-candidate', data);
        }
    });

    // 4. Remote touch gestures
    socket.on('remote-gesture', (data) => {
        const targetRoom = activeRooms[socket.roomId];
        if (targetRoom && targetRoom.hostSocketId) {
            io.to(targetRoom.hostSocketId).emit('remote-gesture', data);
        }
    });

    // 5. Cleanup
    socket.on('disconnect', () => {
        if (socket.roomId && activeRooms[socket.roomId]) {
            if (activeRooms[socket.roomId].hostSocketId === socket.id) {
                console.log(`[Host Terminated] Room closed: ${socket.roomId}`);
                delete activeRooms[socket.roomId];
            } else if (activeRooms[socket.roomId].viewerSocketId === socket.id) {
                console.log(`[Viewer Disconnected] Room: ${socket.roomId}`);
                activeRooms[socket.roomId].viewerSocketId = null;
            }
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`PhoneLink Signaling Server active on port ${PORT}`);
});
