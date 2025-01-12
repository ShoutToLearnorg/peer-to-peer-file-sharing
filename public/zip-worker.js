importScripts('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');

self.onmessage = async function(e) {
    const { files, chunkSize = 5 * 1024 * 1024 } = e.data; // 5MB chunks
    const zip = new JSZip();
    
    try {
        // Process files in parallel
        const addFilePromises = files.map(async (file) => {
            const blob = new Blob(file.content, { type: file.fileType });
            
            // Add files directly to ZIP (no chunking)
            zip.file(file.fileName, blob, {
                compression: 'STORE',
                binary: true
            });

            // Report progress
            self.postMessage({
                type: 'progress',
                fileName: file.fileName,
                progress: 100
            });
        });

        // Wait for all files to be processed
        await Promise.all(addFilePromises);

        // Generate final ZIP
        const content = await zip.generateAsync({
            type: 'blob',
            compression: 'STORE',
            streamFiles: true
        }, (metadata) => {
            self.postMessage({
                type: 'zipProgress',
                progress: metadata.percent
            });
        });

        // Send completed ZIP back
        self.postMessage({
            type: 'complete',
            content: content
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.message
        });
    }
};
