document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const filesContainer = document.getElementById('files-container');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress');
    const statusText = document.getElementById('status-text');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when dragging over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFiles, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        dropZone.classList.add('drag-over');
    }

    function unhighlight(e) {
        dropZone.classList.remove('drag-over');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files } });
    }

    function handleFiles(e) {
        const files = [...e.target.files];
        const validFiles = validateFiles(files);
        
        if (validFiles.length > 0) {
            uploadFiles(validFiles);
        }
    }

    function validateFiles(files) {
        const validTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        const validFiles = files.filter(file => {
            if (!validTypes.includes(file.type)) {
                showError(`File "${file.name}" is not a valid PDF or Word document.`);
                return false;
            }
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                showError(`File "${file.name}" exceeds the 10MB size limit.`);
                return false;
            }
            return true;
        });

        return validFiles;
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        filesContainer.insertBefore(errorDiv, filesContainer.firstChild);
        setTimeout(() => errorDiv.remove(), 5000);
    }

    async function uploadFiles(files) {
        progressContainer.style.display = 'block';
        filesContainer.innerHTML = '';

        for (const file of files) {
            const fileElement = createFileElement(file);
            filesContainer.appendChild(fileElement);

            try {
                await uploadAndProcess(file, fileElement);
            } catch (error) {
                console.error('Error processing file:', error);
                fileElement.querySelector('.file-status').textContent = 'Error: ' + error.message;
                fileElement.querySelector('.file-status').classList.add('error');
                showError(`Failed to process ${file.name}: ${error.message}`);
            }
        }

        progressContainer.style.display = 'none';
    }

    function createFileElement(file) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <div class="file-info">
                <span class="file-name">${file.name}</span>
                <span class="file-status">Waiting...</span>
            </div>
            <div class="file-progress">
                <div class="progress-bar">
                    <div class="progress" style="width: 0%"></div>
                </div>
            </div>
            <div class="file-details"></div>
        `;
        return div;
    }

    async function uploadAndProcess(file, fileElement) {
        const statusElement = fileElement.querySelector('.file-status');
        const progressElement = fileElement.querySelector('.progress');
        const detailsElement = fileElement.querySelector('.file-details');

        // Upload file
        statusElement.textContent = 'Uploading...';
        const formData = new FormData();
        formData.append('file', file);

        try {
            const uploadResponse = await fetch('http://localhost:3000/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                const error = await uploadResponse.json();
                throw new Error(error.error || 'Upload failed');
            }

            const uploadData = await uploadResponse.json();
            statusElement.textContent = 'Processing...';
            progressElement.style.width = '50%';

            // Process file
            const processResponse = await fetch('http://localhost:3000/api/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileId: uploadData.fileId
                })
            });

            if (!processResponse.ok) {
                const error = await processResponse.json();
                throw new Error(error.error || 'Processing failed');
            }

            statusElement.textContent = 'Complete';
            progressElement.style.width = '100%';
            detailsElement.textContent = 'File processed successfully. You can now use the chat interface to ask questions about this document.';

        } catch (error) {
            console.error('Error:', error);
            progressElement.style.width = '0%';
            statusElement.textContent = 'Failed';
            statusElement.classList.add('error');
            detailsElement.innerHTML = `
                <div class="error-details">
                    Error: ${error.message}
                    ${error.details ? `<br>Details: ${error.details}` : ''}
                </div>
            `;
            throw error;
        }
    }
});