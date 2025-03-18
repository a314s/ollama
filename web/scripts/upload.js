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
                alert(`File "${file.name}" is not a valid PDF or Word document.`);
                return false;
            }
            return true;
        });

        return validFiles;
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
        `;
        return div;
    }

    async function uploadAndProcess(file, fileElement) {
        const formData = new FormData();
        formData.append('file', file);

        const statusElement = fileElement.querySelector('.file-status');
        const progressElement = fileElement.querySelector('.progress');

        // Upload file
        statusElement.textContent = 'Uploading...';
        try {
            const response = await fetch('http://localhost:11434/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Process file (convert to embeddings)
            statusElement.textContent = 'Processing...';
            const processResponse = await fetch('http://localhost:11434/api/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileId: data.fileId
                })
            });

            if (!processResponse.ok) {
                throw new Error(`Processing error! status: ${processResponse.status}`);
            }

            statusElement.textContent = 'Complete';
            progressElement.style.width = '100%';

        } catch (error) {
            throw new Error('Failed to process file: ' + error.message);
        }
    }
});