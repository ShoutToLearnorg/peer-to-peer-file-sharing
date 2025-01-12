const fileList = document.getElementById('fileList');
const statusText = document.getElementById('statusText');
const downloadBtn = document.getElementById('downloadBtn');
const downloadSingleFileBtn = document.getElementById('downloadSingleFileBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
let peer, conn;
let files = [];
let fileChunks = {};
let zip = new JSZip(); 

const token = new URLSearchParams(window.location.search).get('token');
if (!token) {
    alert('Missing token.');
    throw new Error('Missing token');
}

const socket = io(); // Connecting to the signaling server

async function fetchPeerId() {
    socket.emit('resolve-token', { token });
    return new Promise((resolve) => {
        socket.on('token-resolved', (data) => {
            resolve(data.peerId);
        });
    });
}

async function initializeReceiver() {
    const senderPeerId = await fetchPeerId();
    console.log('Sender Peer ID:', senderPeerId);

    peer = new Peer();
    peer.on('open', (receiverPeerId) => {
        console.log("Receiver Peer ID:", receiverPeerId);
        statusText.textContent = "Waiting for sender to connect...";
        conn = peer.connect(senderPeerId);

        conn.on('open', () => {
            console.log("Connected to sender!");
            statusText.textContent = "Waiting for file metadata...";
        });

        conn.on('data', (data) => {
if (data.fileName) {
// When file metadata is received
files.push({ fileName: data.fileName, fileType: data.fileType, content: [] });

// Create a container div for each file
const fileContainer = document.createElement('div');
fileContainer.className = 'flex justify-between items-center py-2 px-3 bg-gray-700 rounded-lg';

// Create a div for the file name
const fileNameDiv = document.createElement('div');
fileNameDiv.className = 'text-sm font-medium text-stone-200';
fileNameDiv.textContent = data.fileName;

// Create a div for the file type
const fileTypeDiv = document.createElement('div');
fileTypeDiv.className = 'text-xs px-2 py-1 text-stone-800 bg-stone-200 rounded-md';
fileTypeDiv.textContent = data.fileType;

// Append the file name and type to the file container
fileContainer.appendChild(fileNameDiv);
fileContainer.appendChild(fileTypeDiv);

// Add the file container to the file list
fileList.appendChild(fileContainer);

// Change status message to reflect receiving files
statusText.textContent = "Receiving file chunks...";
} else if (data.chunk) {
// When file chunk is received
const file = files[data.fileIndex];
file.content[data.chunkIndex] = data.chunk;
} else if (data.chunkIndex === -1) {
// When a chunk is fully received and the file is complete
const file = files[data.fileIndex];
const fileBlob = new Blob(file.content, { type: file.fileType });
const fileName = file.fileName;
zip.file(fileName, fileBlob);

// Check if all files are received and update the UI accordingly
if (files.every(f => f.content.length > 0)) {
    if (files.length === 1) {
        downloadSingleFileBtn.style.display = 'block';
        statusText.textContent = "File received. Ready to download.";
    } else {
        downloadBtn.style.display = 'block';
        statusText.textContent = "Files received. Ready to download as ZIP.";
    }
}
}
});



        conn.on('error', (err) => {
            console.error('Connection error:', err);
            statusText.textContent = 'Failed to connect to sender.';
        });

        conn.on('close', () => {
            console.log("Connection closed.");
        });
    });
}

downloadBtn.addEventListener('click', () => {
    statusText.textContent = 'Creating ZIP file...';
    loadingSpinner.style.display = 'block';

    zip.generateAsync({ type: 'blob' })
        .then(function (content) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = "received_files.zip";
            link.click();
            loadingSpinner.style.display = 'none';
            statusText.textContent = 'Download started!';
        });
});

downloadSingleFileBtn.addEventListener('click', () => {
    const file = files[0];
    const fileBlob = new Blob(file.content, { type: file.fileType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(fileBlob);
    link.download = file.fileName;
    link.click();
});

initializeReceiver();