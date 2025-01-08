const PeerServer = require('peer').PeerServer;

const server = PeerServer({
  port: 9000,
  path: '/peerjs'
});

console.log('PeerJS server running on http://localhost:9000');
