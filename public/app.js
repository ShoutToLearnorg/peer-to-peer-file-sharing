const fileInput = document.getElementById('fileInput');
const shareLinkInput = document.getElementById('shareLink');
const generateLinkBtn = document.getElementById('generateLinkBtn');
const startReceivingBtn = document.getElementById('startReceivingBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const statusText = document.getElementById('statusText');

let peer;
let conn;
let file = null;
let fileChannel;

// Initialize PeerJS
function initializePeer() {
    peer = new Peer();  // Generate a unique peer ID for each user
    peer.on('open', (id) => {
        console.log(`Your peer ID is: ${id}`);
        statusText.textContent = `Your Peer ID: ${id}`;
    });

    peer.on('connection', (connection) => {
        console.log('Connection established with peer:', connection.peer);
        conn = connection;

        // On receiving data (file), trigger file download
        conn.on('data', (data) => {
            console.log('Received file data:', data);
            const blob = new Blob([data], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            a.click(); // Trigger file download
        });
    });
}

// Handle file selection and generate a link
generateLinkBtn.addEventListener('click', () => {
    if (!fileInput.files[0]) {
        alert('Please select a file to share');
        return;
    }

    // Get the selected file
    file = fileInput.files[0];

    // Show loading spinner while the connection is being established
    loadingSpinner.style.display = 'block';
    statusText.textContent = 'Initializing WebRTC connection...';

    // Generate the peer link (peer ID)
    const peerId = peer.id;
    const link = `http://localhost:3000/${peerId}`;
    shareLinkInput.value = link;

    // Create the connection and send the file once the data channel is open
    conn = peer.connect(peerId);
    conn.on('open', () => {
        console.log('Connection established with peer:', peerId);
        statusText.textContent = 'Sending file to peer...';

        // Send the file to the connected peer
        conn.send(file);

        // Hide the loading spinner after sending the file
        loadingSpinner.style.display = 'none';
    });

    conn.on('error', (err) => {
        console.error('Connection error:', err);
        loadingSpinner.style.display = 'none';
        statusText.textContent = 'Connection error. Please try again.';
    });
});

// Start receiving a file by entering the peer ID
startReceivingBtn.addEventListener('click', () => {
    const peerId = prompt('Enter the peer ID of the sender:');
    if (!peerId) {
        alert('Peer ID is required');
        return;
    }

    // Create the connection with the sender
    conn = peer.connect(peerId);
    conn.on('open', () => {
        console.log('Connected to peer:', peerId);
        statusText.textContent = 'Waiting for file transfer...';
    });

    conn.on('data', (data) => {
        console.log('Received file data:', data);
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click(); // Trigger file download
    });

    conn.on('error', (err) => {
        console.error('Error:', err);
        statusText.textContent = 'Error receiving file. Try again later.';
    });
});

// Initialize PeerJS when the page loads
initializePeer();
