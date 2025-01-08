const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Peer = require('peer');
const app = express();
const server = http.createServer(app);

// Create socket.io instance with CORS and transports configuration
const io = socketIo(server, {
    transports: ['websocket', 'polling'], // Allow both websocket and polling
    cors: {
        origin: '*', // Allow all origins (you can set this to your frontend URL if needed)
        methods: ['GET', 'POST'],
    }
});

// Serve static files (e.g., sender.html, receiver.html)
app.use(express.static('public'));

// Mock database to store peerId and tokens
let tokens = {};

// Endpoint to initialize PeerJS server
const peerServer = Peer.ExpressPeerServer(server, {
    path: '/peerjs',
});

// Attach PeerJS server to the Express app
app.use('/peerjs', peerServer);

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

// Serve the application on port 3000
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
