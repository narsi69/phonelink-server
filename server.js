const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Rooms storage: roomId -> { hostSocketId, pin, viewerSocketId }
const rooms = {};

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Host registration from Android Host app
    socket.on('register-host', (data) => {
        const { roomId, pin } = data;
        if (!roomId || !pin) return;

        rooms[roomId] = {
            hostSocketId: socket.id,
            pin: pin,
            viewerSocketId: null
        };
        socket.join(roomId);
        console.log(`Host registered for Room ID: ${roomId} with PIN: ${pin}`);
        socket.emit('host-registered', { success: true, roomId });
    });

    // Viewer joining (from Android Controller app or Web Viewer) and authenticating with PIN
    socket.on('join-room', (data) => {
        const { roomId, pin } = data;
        const room = rooms[roomId];

        if (!room) {
            socket.emit('error-msg', 'Room not found or host is offline.');
            return;
        }

        if (room.pin !== pin) {
            socket.emit('error-msg', 'Invalid Security PIN.');
            return;
        }

        room.viewerSocketId = socket.id;
        socket.join(roomId);
        console.log(`Viewer authenticated for Room ID: ${roomId}`);
        
        socket.emit('joined-success');
        
        // Notify Android Host app that viewer is ready to generate WebRTC Offer
        io.to(room.hostSocketId).emit('viewer-ready');
    });

    // WebRTC Offer from Android Host app
    socket.on('offer', (offer) => {
        const roomId = getRoomIdBySocket(socket.id);
        if (roomId && rooms[roomId] && rooms[roomId].viewerSocketId) {
            io.to(rooms[roomId].viewerSocketId).emit('offer', offer);
            console.log(`Offer relayed to viewer in room ${roomId}`);
        }
    });

    // WebRTC Answer from Viewer (Android Controller or Web)
    socket.on('answer', (answer) => {
        const roomId = getRoomIdBySocket(socket.id);
        if (roomId && rooms[roomId] && rooms[roomId].hostSocketId) {
            io.to(rooms[roomId].hostSocketId).emit('answer', answer);
            console.log(`Answer relayed to host in room ${roomId}`);
        }
    });

    // ICE Candidates relay between Host and Viewer
    socket.on('ice-candidate', (candidate) => {
        const roomId = getRoomIdBySocket(socket.id);
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        if (socket.id === room.hostSocketId && room.viewerSocketId) {
            io.to(room.viewerSocketId).emit('ice-candidate', candidate);
        } else if (socket.id === room.viewerSocketId && room.hostSocketId) {
            io.to(room.hostSocketId).emit('ice-candidate', candidate);
        }
    });

    // Remote Gestures (Tap/Swipe) from Viewer to Android Host app
    socket.on('remote-gesture', (gestureData) => {
        const roomId = getRoomIdBySocket(socket.id);
        if (roomId && rooms[roomId] && rooms[roomId].hostSocketId) {
            io.to(rooms[roomId].hostSocketId).emit('remote-gesture', gestureData);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        for (const [roomId, room] of Object.entries(rooms)) {
            if (room.hostSocketId === socket.id) {
                console.log(`Host disconnected from room ${roomId}`);
                if (room.viewerSocketId) {
                    io.to(room.viewerSocketId).emit('host-disconnected');
                }
                delete rooms[roomId];
            } else if (room.viewerSocketId === socket.id) {
                console.log(`Viewer disconnected from room ${roomId}`);
                room.viewerSocketId = null;
                io.to(room.hostSocketId).emit('viewer-disconnected');
            }
        }
    });
});

function getRoomIdBySocket(socketId) {
    for (const [roomId, room] of Object.entries(rooms)) {
        if (room.hostSocketId === socketId || room.viewerSocketId === socketId) {
            return roomId;
        }
    }
    return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});
