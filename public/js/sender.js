// Critical Variables and Constants
let peer;
let conn;
let files = [];
const CHUNK_SIZE = 1024 * 1024; // 1MB per chunk
const socket = io(); // Connecting to the signaling server

// DOM Elements
const fileInput = document.getElementById('dropzone-file');
const fileInputSection = document.getElementById('fileInputSection');
const fileListSection = document.getElementById('fileListSection');
const shareLinkSection = document.getElementById('shareLinkSection');
const fileList = document.getElementById('fileList');
const shareLinkInput = document.getElementById('shareLink');
const generateLinkBtn = document.getElementById('generateLinkBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const statusText = document.getElementById('statusText');

// Initialize Peer Immediately on Load
window.addEventListener('DOMContentLoaded', () => {
    showLoadingIndicator("Initializing connection...");
    initializePeer();
});

let peerId; // Define a global variable to store the Peer ID

// Track total chunks sent and total chunks to send
let totalChunksSent = 0;
let totalChunksToSend = 0;

let combinedProgressBar; // Reference to the combined progress bar

function hideLoadingIndicator() {
    loadingSpinner.style.display = 'none';
    statusText.textContent = `Your Peer ID: ${peerId}`;
}

function initializePeer() {
    console.log("Initializing PeerJS...");
    peer = new Peer();

    peer.on('open', (id) => {
        peerId = id; // Store the Peer ID globally
        console.log(`Peer ID generated: ${id}`);
        hideLoadingIndicator();
        generateLinkBtn.disabled = false; // Enable button once Peer ID is ready
    });

    peer.on('error', (err) => {
        console.error("PeerJS error:", err);
        statusText.textContent = "Error initializing PeerJS. Check the console for details.";
    });

    peer.on('connection', (connection) => {
        console.log("Receiver connected. Preparing to send files...");
        conn = connection;

        conn.on('open', () => {
            console.log("Connection open. Sending file metadata...");
            
            // Show the progress bar as soon as the transfer starts
            showProgressBar();
        
            // Now send the file metadata and transfer chunks
            files.forEach((file, index) => {
                const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
                conn.send({
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    totalChunks: totalChunks,
                });
                console.log(`Sending file metadata: ${file.name}, Total Chunks: ${totalChunks}`);
                sendFileInChunks(file, index);
            });
        
            console.log("All files sent:", files.map(file => file.name));
        });
        

        conn.on('error', (err) => {
            console.error("Error during file transfer:", err);
            statusText.textContent = "Error during file transfer.";
        });
    });
}

fileInput.addEventListener('change', () => {
    files = Array.from(fileInput.files);
    updateFileList();
});

function updateFileList() {
    fileInputSection.style.display = 'none'; // Hide the file input section
    fileListSection.style.display = 'block'; // Show the file list section
    generateLinkBtn.style.display = 'block'; // Show the button when files are selected

    // Center the button horizontally
    generateLinkBtn.classList.add('mx-auto');
    fileList.innerHTML = ''; // Clear the current list

    if (files.length > 0) {
        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = "w-full border-b border-stone-300 dark:border-stone-700 last:border-0";
            fileItem.innerHTML = `
                <div class="flex justify-between items-center py-2 pl-3 pr-2">
                    <p class="truncate text-sm font-medium text-stone-800 dark:text-stone-200">${file.name}</p>
                    <div class="flex items-center">
                        <div class="px-2 py-1 text-[10px] font-semibold rounded bg-stone-100 dark:bg-stone-900 text-stone-800 dark:text-stone-200 transition-all duration-300">${file.type}</div>
                        <button class="text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 focus:outline-none pl-3 pr-1" onclick="removeFile(${index})">✕</button>
                    </div>
                </div>
            `;
            fileList.appendChild(fileItem);
        });

        // Enable the "Generate Link" button when files are selected
        generateLinkBtn.disabled = false;
    }
}

function removeFile(index) {
    files.splice(index, 1); // Remove file from the array
    updateFileList(); // Re-render the file list

    // If no files are left, revert to the initial UI state
    if (files.length === 0) {
        fileInputSection.style.display = 'block'; // Show the file input section
        fileListSection.style.display = 'none'; // Hide the file list section
        shareLinkSection.style.display = 'none'; // Hide the share link section
        generateLinkBtn.disabled = true; // Disable the generate link button
    }
}

generateLinkBtn.addEventListener('click', async () => {
    if (files.length === 0) {
        alert('Please select files to share');
        return;
    }

    // Check if Peer ID is available before generating the link
    if (!peerId) {
        alert('Peer ID not generated yet. Please wait...');
        return;
    }

    console.log("Files selected:", files);
    showLoadingIndicator('Generating shareable link and initializing WebRTC...');
    socket.emit('generate-token', { peerId: peerId });

    socket.on('token-generated', (data) => {
        const token = data.token;
        const link = `https://packetpanda.shouttocode.com/receiver.html?token=${token}`;
        shareLinkInput.value = link;

        console.log("Shareable link generated:", link);
        statusText.textContent = `Copy and Share with Your Peers!`;
        hideLoadingIndicator();
        shareLinkSection.style.display = 'block'; // Show the shareable link section
    });
});

function sendFileInChunks(file, index) {
    const reader = new FileReader();
    let start = 0;
    let end = CHUNK_SIZE;
    let chunkIndex = 0;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    totalChunksToSend += totalChunks; // Update the total chunks to send

    // Show progress bar when the transfer starts
    showProgressBar();

    function updateProgress() {
        // Calculate total progress across all files
        const percentage = (totalChunksSent / totalChunksToSend) * 100;
        updateCombinedProgress(percentage); // Update the shared progress bar
    }

    function sendChunk() {
        if (start < file.size) {
            const chunk = file.slice(start, end);
            reader.readAsArrayBuffer(chunk);
        } else {
            conn.send({ fileIndex: index, chunkIndex: -1, isLastChunk: true });
            console.log(`Finished sending file: ${file.name}`);
        }
    }

    reader.onload = (event) => {
        const chunk = event.target.result;
        if (conn && conn.open) {
            conn.send({
                fileIndex: index,
                chunkIndex: chunkIndex,
                chunk: chunk,
                isLastChunk: end >= file.size,
            });
            console.log(`Sent chunk ${chunkIndex + 1} of ${totalChunks} for ${file.name}`);
        }

        start = end;
        end = start + CHUNK_SIZE;
        chunkIndex++;

        totalChunksSent++; // Increment the total chunks sent
        updateProgress(); // Update the shared progress bar
    };

    // Listen for receiver acknowledgment
    conn.on('data', (data) => {
        if (data.fileIndex === index && data.chunkIndex === chunkIndex - 1) {
            sendChunk(); // Send the next chunk upon acknowledgment
        }
    });

    // Start sending the first chunk
    sendChunk();
}


// Function to show the progress bar when the transfer starts
function showProgressBar() {
    // Ensure the progress bar container is shown
    const progressBarContainer = document.getElementById('progress-bar-container');
    if (progressBarContainer) {
        progressBarContainer.style.display = 'block';
    }

    // Initialize the progress bar reference if not already done
    if (!combinedProgressBar) {
        combinedProgressBar = document.querySelector('.combined-progress-bar');
    }
}



function updateCombinedProgress(percentage) {
    if (combinedProgressBar) {
        combinedProgressBar.style.width = `${percentage}%`;
    }

    // When the progress reaches 100%, hide the progress bar and show a success message
    if (percentage >= 100) {
        // Hide the progress bar
        document.getElementById('progress-bar-container').style.display = 'none';
        
        // Show the "File Sent Successfully" message
        statusText.textContent = "File sent successfully!";
        
        // Optionally, you can reset the progress bar for the next file transfer
        setTimeout(() => {
            statusText.textContent = "Sending next file..."; // Or any other message for the next file
        }, 2000); // Show the success message for 2 seconds
    }
}


document.querySelector('[data-copy-to-clipboard-target]').addEventListener('click', () => {
    const input = document.getElementById('shareLink'); // The target input field
    input.select();
    input.setSelectionRange(0, 99999); // For mobile devices

    navigator.clipboard.writeText(input.value).then(() => {
        // Show the success message
        document.getElementById('default-message').classList.add('hidden');
        document.getElementById('success-message').classList.remove('hidden');

        // Reset after a short delay
        setTimeout(() => {
            document.getElementById('default-message').classList.remove('hidden');
            document.getElementById('success-message').classList.add('hidden');
        }, 2000);
    }).catch((err) => {
        console.error('Failed to copy:', err);
    });
});

function showLoadingIndicator(message) {
    loadingSpinner.style.display = 'block';
    statusText.textContent = message;
}
