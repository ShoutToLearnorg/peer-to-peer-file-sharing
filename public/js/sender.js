  
        const fileInput = document.getElementById('dropzone-file');
        const fileInputSection = document.getElementById('fileInputSection');
        const fileListSection = document.getElementById('fileListSection');
        const shareLinkSection = document.getElementById('shareLinkSection');
        const fileList = document.getElementById('fileList');
        const shareLinkInput = document.getElementById('shareLink');
        const generateLinkBtn = document.getElementById('generateLinkBtn');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const statusText = document.getElementById('statusText');
        let peer;
        let conn;
        let files = [];
        const CHUNK_SIZE = 1024 * 1024; // 1MB per chunk
        const socket = io(); // Connecting to the signaling server

        function initializePeer() {
            console.log("Initializing PeerJS...");
            peer = new Peer();

            peer.on('open', (id) => {
                console.log(`Peer ID generated: ${id}`);
                statusText.textContent = `Your Peer ID: ${id}`;
                generateLinkBtn.disabled = false;
            });

            peer.on('error', (err) => {
                console.error("PeerJS error:", err);
                statusText.textContent = "Error initializing PeerJS. Check the console for details.";
            });
        }

        fileInput.addEventListener('change', () => {
            files = Array.from(fileInput.files);
            updateFileList();
        });

        function updateFileList() {
            fileInputSection.style.display = 'none';  // Hide the file input section
            fileListSection.style.display = 'block';  // Show the file list section

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
                fileListSection.style.display = 'none';   // Hide the file list section
                shareLinkSection.style.display = 'none';  // Hide the share link section
                generateLinkBtn.disabled = true;         // Disable the generate link button
            }
        }

        generateLinkBtn.addEventListener('click', async () => {
            if (files.length === 0) {
                alert('Please select files to share');
                return;
            }

            console.log("Files selected:", files);

            loadingSpinner.style.display = 'block';
            statusText.textContent = 'Generating shareable link and initializing WebRTC...';

            // Send peer ID to the server for token generation
            socket.emit('generate-token', { peerId: peer.id });

            socket.on('token-generated', (data) => {
                const token = data.token;
                const link = `http://localhost:3000/receiver.html?token=${token}`;
                shareLinkInput.value = link;

                console.log("Shareable link generated:", link);
                statusText.textContent = `Shareable link: ${link}`;
                loadingSpinner.style.display = 'none';
                shareLinkSection.style.display = 'block';  // Show the shareable link section
            });

            peer.on('connection', (connection) => {
    conn = connection;
    console.log("Receiver connected. Preparing to send files...");

    conn.on('open', () => {
        console.log("Connection open. Sending file metadata...");
        files.forEach((file, index) => {
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE); // Calculate total chunks
            conn.send({
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                totalChunks: totalChunks, // Include total chunk count
            });
            console.log(`Sending file metadata: ${file.name}, Total Chunks: ${totalChunks}`);
            sendFileInChunks(file, index); // Send file chunks
        });

        statusText.textContent = "All files sent successfully!";
        console.log("All files sent:", files.map(file => file.name));
    });

    conn.on('error', (err) => {
        console.error("Error during file transfer:", err);
        statusText.textContent = "Error during file transfer.";
    });
});
});

function sendFileInChunks(file, index) {
    const reader = new FileReader();
    let start = 0;
    let end = CHUNK_SIZE;
    let chunkIndex = 0;

    reader.onload = (event) => {
        const chunk = event.target.result;
        conn.send({
            fileIndex: index,
            chunkIndex: chunkIndex,
            chunk: chunk,
            isLastChunk: end >= file.size, // Mark the last chunk
        });

        console.log(`Sending chunk ${chunkIndex + 1} of ${file.name}`);

        start = end;
        end = start + CHUNK_SIZE;

        if (start < file.size) {
            chunkIndex++;
            reader.readAsArrayBuffer(file.slice(start, end));
        } else {
            // Notify receiver about EOF for this file
            conn.send({ fileIndex: index, chunkIndex: -1, isLastChunk: true });
            console.log(`Finished sending file: ${file.name}`);
        }
    };

    reader.readAsArrayBuffer(file.slice(start, end));
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



        initializePeer();