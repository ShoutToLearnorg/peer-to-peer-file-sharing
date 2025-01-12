const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Peer = require('peer');
const app = express();

// Create the main HTTP server for Socket.IO
const server = http.createServer(app);

// Setup Socket.IO with the necessary CORS configuration
const io = socketIo(server, {
    transports: ['websocket', 'polling'],
    cors: {
        origin: '*', // Allow all origins (change as needed)
        methods: ['GET', 'POST'],
    }
});

// Mock database to store peerId and tokens
let tokens = {};

// Serve static files (sender.html, receiver.html)
app.use(express.static('public'));

// Handle socket connection and token management
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Generate a token for a peer
    socket.on('generate-token', (data) => {
        const token = Math.random().toString(36).substring(2, 15);
        tokens[token] = data.peerId;
        console.log(`Generated token for peerId ${data.peerId}: ${token}`);
        socket.emit('token-generated', { token });
    });

    // Resolve token to peerId
    socket.on('resolve-token', (data) => {
        const peerId = tokens[data.token];
        if (peerId) {
            socket.emit('token-resolved', { peerId });
        } else {
            socket.emit('token-resolved', { peerId: null });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Create a new HTTP server for PeerJS
const peerServerHttp = http.createServer();
const peerServer = Peer.ExpressPeerServer(peerServerHttp, { path: '/peerjs' });

// Make sure to listen on all network interfaces (0.0.0.0) for external access
peerServerHttp.on('request', (req, res) => peerServer(req, res));

// Listen on external IP or domain and make it accessible
peerServerHttp.listen(9000, '0.0.0.0', () => {
    console.log('PeerJS server running on port 9000');
});


// Serve the application on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Socket.IO server running on port ${PORT}`);
});
