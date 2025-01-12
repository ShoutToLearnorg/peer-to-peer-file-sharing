const fileList = document.getElementById('fileList');
        const statusText = document.getElementById('statusText');
        const downloadBtn = document.getElementById('downloadBtn');
        let peer, conn;
        let files = [];
        let zip = new JSZip(); 
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
            return new Promise((resolve) => {
                socket.on('token-resolved', (data) => {
                    resolve(data.peerId);
                });
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
                        files.push({ 
                            fileName: data.fileName, 
                            fileType: data.fileType, 
                            fileSize: data.fileSize, 
                            content: Array(data.totalChunks).fill(null),
                            totalChunks: data.totalChunks,
                            isComplete: false
                        });
    
                        const fileContainer = document.createElement('div');
                        fileContainer.className = 'flex flex-col p-3 bg-gray-700 rounded-lg mb-4';
    
                        const headerDiv = document.createElement('div');
                        headerDiv.className = 'flex justify-between items-center';
    
                        const fileNameDiv = document.createElement('div');
                        fileNameDiv.className = 'text-sm font-medium text-stone-200';
                        fileNameDiv.textContent = `${data.fileName}`;
                        
                        const fileTypeDiv = document.createElement('div');
                        fileTypeDiv.className = 'text-xs px-2 py-1 text-stone-800 bg-stone-200 rounded-md ml-4';
                        fileTypeDiv.textContent = data.fileType;
    
                        headerDiv.appendChild(fileNameDiv);
                        headerDiv.appendChild(fileTypeDiv);
    
                        const fileSizeDiv = document.createElement('div');
                        fileSizeDiv.className = 'text-xs text-gray-400 mt-1';
                        fileSizeDiv.textContent = `Size: ${(data.fileSize / (1024 * 1024)).toFixed(2)} MB`;
    
                        const chunkCountDiv = document.createElement('div');
                        chunkCountDiv.className = 'text-xs text-gray-400 mt-1';
                        chunkCountDiv.id = `chunkCount-${files.length - 1}`;
                        chunkCountDiv.textContent = `Chunks: 0/${data.totalChunks}`;
    
                        fileContainer.appendChild(headerDiv);
                        fileContainer.appendChild(fileSizeDiv);
                        fileContainer.appendChild(chunkCountDiv);
    
                        fileList.appendChild(fileContainer);
    
                        statusText.textContent = "Receiving file chunks...";
                    } else if (data.chunk) {
                        const file = files[data.fileIndex];
                        file.content[data.chunkIndex] = data.chunk;
    
                        const chunkCountDiv = document.getElementById(`chunkCount-${data.fileIndex}`);
                        const receivedChunks = file.content.filter(chunk => chunk !== null).length;
                        chunkCountDiv.textContent = `Chunks: ${receivedChunks}/${file.totalChunks}`;
    
                        if (receivedChunks === file.totalChunks) {
                            file.isComplete = true;
                        }
    
                        if (files.every(f => f.isComplete)) {
                            // Check if there is only one file
                            if (files.length === 1) {
                                // Only one file, trigger direct download
                                downloadBtn.textContent = `Download ${files[0].fileName}`;
                                downloadBtn.onclick = () => downloadSingleFile(files[0]);
                            } else {
                                // Multiple files, trigger ZIP download
                                downloadBtn.textContent = 'Download All as ZIP';
                                downloadBtn.onclick = downloadZipFile;
                            }
                            downloadBtn.style.display = 'block';
                            statusText.textContent = "All files received. You can download individually or as ZIP.";
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
        }
    
        // Initialize receiver
        initializeReceiver();