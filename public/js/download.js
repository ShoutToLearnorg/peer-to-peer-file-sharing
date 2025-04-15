const fileList = document.getElementById('fileList');
const statusText = document.getElementById('statusText');
const downloadBtn = document.getElementById('downloadBtn');
let peer, conn;
let files = [];
let zipFileContent = null;

downloadBtn.style.display = 'none';

const token = new URLSearchParams(window.location.search).get('token');
if (!token) {
    alert('Missing token.');
    throw new Error('Missing token');
}

const socket = io();

async function fetchPeerId() {
    socket.emit('resolve-token', { token });
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Peer ID resolution timed out")), 10000); // 10 seconds
        socket.on('token-resolved', (data) => {
            clearTimeout(timeout);
            resolve(data.peerId);
        });
        socket.on('error', () => reject(new Error("Socket error during peer ID resolution")));
    });
}

// Function to download a single file directly
async function downloadSingleFile(file) {
    const blob = new Blob(file.content, { type: file.fileType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.fileName;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}

// Function to create ZIP and trigger download
async function downloadZipFile() {
    console.log('Download button clicked.');

    if (zipFileContent) {
        const url = URL.createObjectURL(zipFileContent);
        const link = document.createElement('a');
        link.href = url;
        link.download = `received_files_${new Date().getTime()}.zip`;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 1000);
        return;
    }

    try {
        statusText.textContent = 'Preparing files for download...';

        const worker = new Worker('zip-worker.js');
        worker.onmessage = async (e) => {
            const { type, progress, content, error } = e.data;

            switch (type) {
                case 'zipProgress':
                    statusText.textContent = `Creating ZIP: ${Math.round(progress)}%`;
                    break;

                case 'complete':
                    zipFileContent = content;
                    const url = URL.createObjectURL(zipFileContent);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `received_files_${new Date().getTime()}.zip`;
                    document.body.appendChild(link);
                    link.click();

                    setTimeout(() => {
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        worker.terminate();
                    }, 1000);

                    statusText.textContent = 'Download complete!';
                    break;

                case 'error':
                    throw new Error(error);
            }
        };

        worker.postMessage({ files });
    } catch (err) {
        console.error('ZIP creation/download error:', err);
        statusText.textContent = `ZIP creation failed: ${err.message}. Falling back to individual downloads...`;
    }
}

// Handle all files received
function handleAllFilesReceived() {
    if (files.length === 1) {
        downloadBtn.textContent = `Download ${files[0].fileName}`;
        downloadBtn.onclick = () => downloadSingleFile(files[0]);
    } else {
        downloadBtn.textContent = 'Download All as ZIP';
        downloadBtn.onclick = downloadZipFile;
    }
    downloadBtn.style.display = 'block';
    statusText.textContent = "All files received. You can download individually or as ZIP.";
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
                // Handle file metadata
                files.push({
                    fileName: data.fileName,
                    fileType: data.fileType,
                    fileSize: data.fileSize,
                    content: Array(data.totalChunks).fill(null),
                    totalChunks: data.totalChunks,
                    isComplete: false
                });
        
                const fileContainer = document.createElement('div');
                fileContainer.className = 'flex flex-col p-4 border border-white rounded-lg bg-[#2a2a2a] rounded-lg mb-4';
        
                const headerDiv = document.createElement('div');
                headerDiv.className = 'flex justify-between items-center';
        
                const fileNameDiv = document.createElement('div');
                fileNameDiv.className = 'text-sm text-white opacity-80';
                fileNameDiv.textContent = `${data.fileName}`;
        
                const fileTypeDiv = document.createElement('div');
                fileTypeDiv.className = 'text-xs px-2 py-1 text-stone-800 bg-stone-200 rounded-md ml-4';
                fileTypeDiv.textContent = data.fileType;
        
                headerDiv.appendChild(fileNameDiv);
                headerDiv.appendChild(fileTypeDiv);
        
                const fileSizeDiv = document.createElement('div');
                fileSizeDiv.className = 'text-xs text-white opacity-50 mt-2';
                fileSizeDiv.textContent = `Size: ${(data.fileSize / (1024 * 1024)).toFixed(2)} MB`;
        
                const chunkCountDiv = document.createElement('div');
                chunkCountDiv.className = 'text-xs text-white opacity-50 mt-1';
                chunkCountDiv.id = `chunkCount-${files.length - 1}`;
                chunkCountDiv.textContent = `Chunks: 0/${data.totalChunks}`;
        
                fileContainer.appendChild(headerDiv);
                fileContainer.appendChild(fileSizeDiv);
                fileContainer.appendChild(chunkCountDiv);
        
                fileList.appendChild(fileContainer);
        
                statusText.textContent = "Receiving file chunks...";
            } else if (data.chunk) {
                // Handle file chunk
                const file = files[data.fileIndex];
                if (!file) {
                    console.error(`File index ${data.fileIndex} not found`);
                    return;
                }
        
                file.content[data.chunkIndex] = new Uint8Array(data.chunk);
        
                const receivedChunks = file.content.filter(chunk => chunk !== null).length;
                const chunkCountDiv = document.getElementById(`chunkCount-${data.fileIndex}`);
                chunkCountDiv.textContent = `Chunks: ${receivedChunks}/${file.totalChunks}`;
        
                // Acknowledge the receipt of the chunk
                conn.send({
                    fileIndex: data.fileIndex,
                    chunkIndex: data.chunkIndex,
                    status: "received"
                });
        
                if (receivedChunks === file.totalChunks) {
                    file.isComplete = true;
                }
        
                if (files.every(f => f.isComplete)) {
                    handleAllFilesReceived();
                }
            }
        });
        

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            statusText.textContent = 'Failed to connect to sender.';
        });

        conn.on('close', () => {
            console.log("Connection closed.");
            statusText.textContent = "Connection closed.";
        });
    });

    peer.on('error', (err) => {
        console.error("Peer error:", err);
        statusText.textContent = 'An error occurred. Please try reconnecting.';
    });

    peer.on('disconnected', () => {
        console.warn("Peer disconnected. Reconnecting...");
        peer.reconnect();
    });
}

// Initialize receiver
initializeReceiver();