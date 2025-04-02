/**
 * Document management functionality for the NaviTechAid Web UI
 */
class DocumentsManager {
    constructor() {
        this.documentsList = document.getElementById('documents-list');
        this.uploadDocumentBtn = document.getElementById('upload-document-btn');
        this.dropArea = document.getElementById('document-drop-area');
        this.uploadProgress = document.getElementById('upload-progress');
        this.troubleshootBtn = document.getElementById('documents-troubleshoot-btn');
        
        this.documents = [];
        this.isUploading = false;
        
        this.init();
    }
    
    /**
     * Initialize the documents management functionality
     */
    init() {
        // Load documents
        this.loadDocuments();
        
        // Set up upload button
        this.uploadDocumentBtn.addEventListener('click', () => {
            // Create a file input element
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.pdf,.txt,.md,.doc,.docx,.csv';
            fileInput.multiple = true;
            
            // Handle file selection
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });
            
            // Trigger file selection dialog
            fileInput.click();
        });
        
        // Set up drag and drop
        this.setupDragAndDrop();
        
        // Set up troubleshoot button
        this.troubleshootBtn.addEventListener('click', () => {
            document.getElementById('documents-troubleshooting-dialog').classList.add('active');
        });
        
        // Set up event delegation for document actions
        this.documentsList.addEventListener('click', (e) => {
            // Handle view button
            if (e.target.classList.contains('view-document')) {
                const documentId = e.target.dataset.id;
                this.viewDocument(documentId);
            }
            
            // Handle delete button
            if (e.target.classList.contains('delete-document')) {
                const documentId = e.target.dataset.id;
                this.confirmDeleteDocument(documentId);
            }
        });
    }
    
    /**
     * Set up drag and drop functionality
     */
    setupDragAndDrop() {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });
        
        // Highlight drop zone when dragging over it
        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropArea.addEventListener(eventName, () => {
                this.dropArea.classList.add('drag-over');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            this.dropArea.addEventListener(eventName, () => {
                this.dropArea.classList.remove('drag-over');
            }, false);
        });
        
        // Handle dropped files
        this.dropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            this.handleFileUpload(files);
        }, false);
    }
    
    /**
     * Prevent default drag and drop behaviors
     * @param {Event} e - The event object
     */
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    /**
     * Handle file upload
     * @param {FileList} files - The files to handle
     */
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        // First validate document functionality
        if (window.connectionManager) {
            const validationResult = await window.connectionManager.validateDocumentFunctionality();
            if (!validationResult.success) {
                uiManager.showToast(validationResult.message, 'error');
                this.showTroubleshootingSteps();
                return;
            }
        }
        
        const validFiles = this.validateFiles([...files]);
        
        if (validFiles.length > 0) {
            this.uploadFiles(validFiles);
        }
    }
    
    /**
     * Validate files for upload
     * @param {Array<File>} files - The files to validate
     * @returns {Array<File>} - The valid files
     */
    validateFiles(files) {
        const validTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/markdown',
            'text/csv'
        ];
        
        const validFiles = files.filter(file => {
            if (!validTypes.includes(file.type)) {
                uiManager.showToast(`File "${file.name}" is not a supported document type.`, 'warning');
                return false;
            }
            
            if (file.size > 50 * 1024 * 1024) { // 50MB limit
                uiManager.showToast(`File "${file.name}" exceeds the 50MB size limit.`, 'warning');
                return false;
            }
            
            return true;
        });
        
        return validFiles;
    }
    
    /**
     * Show troubleshooting steps for document issues
     */
    showTroubleshootingSteps() {
        if (!window.connectionManager) {
            return;
        }
        
        const steps = window.connectionManager.getTroubleshootingSteps('documents');
        
        // Create a modal to display troubleshooting steps
        const modal = document.createElement('div');
        modal.className = 'dialog active';
        
        modal.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>Document Processing Troubleshooting</h3>
                    <button class="close-dialog">&times;</button>
                </div>
                <div class="dialog-body">
                    <p>Try these steps to resolve document processing issues:</p>
                    <ul class="troubleshooting-steps">
                        ${steps.map(step => `<li>${step}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close button functionality
        modal.querySelector('.close-dialog').addEventListener('click', () => {
            modal.remove();
        });
    }
    
    /**
     * Upload files to the server
     * @param {Array<File>} files - The files to upload
     */
    async uploadFiles(files) {
        // Show progress container
        this.uploadProgress.style.display = 'block';
        this.uploadProgress.textContent = 'Preparing files...';
        
        // Check connection first
        if (window.connectionManager && !window.connectionManager.isConnected) {
            try {
                const connected = await window.connectionManager.checkConnection();
                if (!connected) {
                    throw new Error('Not connected to NaviTechAid server. Please check your connection.');
                }
            } catch (error) {
                this.uploadProgress.style.display = 'none';
                uiManager.showToast('Connection error: ' + error.message, 'error');
                return;
            }
        }
        
        let uploadSuccess = false;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.uploadProgress.textContent = `Uploading ${file.name} (${i + 1}/${files.length})...`;
            
            try {
                await naviTechAidAPI.uploadDocument(file);
                
                uiManager.showToast(`Successfully uploaded ${file.name}`, 'success');
                uploadSuccess = true;
                
                // Log successful upload to connection manager
                if (window.connectionManager) {
                    window.connectionManager.logConnectionEvent(`Document uploaded: ${file.name}`, 'success');
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                uiManager.showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
                
                // Log error to connection manager
                if (window.connectionManager) {
                    window.connectionManager.logConnectionEvent(`Document upload error: ${error.message}`, 'error');
                }
            }
        }
        
        // Hide progress container
        this.uploadProgress.style.display = 'none';
        
        // Reload documents if at least one upload was successful
        if (uploadSuccess) {
            this.loadDocuments();
        }
    }
    
    /**
     * Load available documents
     */
    async loadDocuments() {
        try {
            // Check connection first
            if (window.connectionManager && !window.connectionManager.isConnected) {
                const connected = await window.connectionManager.checkConnection();
                if (!connected) {
                    throw new Error('Not connected to NaviTechAid server. Please check your connection.');
                }
            }
            
            // Validate document functionality
            if (window.connectionManager) {
                const validationResult = await window.connectionManager.validateDocumentFunctionality();
                if (!validationResult.success) {
                    throw new Error(validationResult.message);
                }
            }
            
            this.documentsList.innerHTML = '<div class="loading">Loading documents...</div>';
            
            const response = await fetch(`${naviTechAidAPI.baseUrl}/api/documents`);
            
            if (!response.ok) {
                throw new Error(`Failed to load documents: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            this.documents = data.documents || [];
            
            // Display documents
            this.displayDocuments();
            
        } catch (error) {
            console.error('Error loading documents:', error);
            this.displayDocumentsLoadingError(error.message);
        }
    }
    
    /**
     * Display documents
     */
    displayDocuments() {
        if (!this.documents || this.documents.length === 0) {
            this.documentsList.innerHTML = '<div class="empty-state">No documents available. Upload a document to get started.</div>';
            return;
        }
        
        // Clear the list
        this.documentsList.innerHTML = '';
        
        // Add documents to the list
        this.documents.forEach(document => {
            const documentCard = uiManager.createDocumentCard(document);
            this.documentsList.appendChild(documentCard);
        });
    }
    
    /**
     * Display documents loading error
     * @param {string} message - The error message
     */
    displayDocumentsLoadingError(message) {
        this.documentsList.innerHTML = `
            <div class="error-state">
                <p>Failed to load documents: ${message}</p>
                <p>Click the "Troubleshoot" button for help resolving this issue.</p>
            </div>
        `;
    }
    
    /**
     * View document details
     * @param {string} documentId - The ID of the document to view
     */
    async viewDocument(documentId) {
        try {
            // Check connection first
            if (window.connectionManager && !window.connectionManager.isConnected) {
                const connected = await window.connectionManager.checkConnection();
                if (!connected) {
                    throw new Error('Not connected to NaviTechAid server. Please check your connection.');
                }
            }
            
            // Create a modal to display document details
            const modal = document.createElement('div');
            modal.className = 'dialog active';
            
            modal.innerHTML = `
                <div class="dialog-content">
                    <div class="dialog-header">
                        <h3>Document Details</h3>
                        <button class="close-dialog">&times;</button>
                    </div>
                    <div class="dialog-body">
                        <div class="loading">Loading document details...</div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Close button functionality
            modal.querySelector('.close-dialog').addEventListener('click', () => {
                modal.remove();
            });
            
            // Load document details
            const response = await fetch(`${naviTechAidAPI.baseUrl}/api/documents/${documentId}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load document details: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            const document = data.document || {};
            
            // Format file size
            const size = uiManager.formatFileSize(document.filesize || 0);
            
            // Get file extension for type
            const fileType = document.filename.split('.').pop().toUpperCase();
            
            // Create tabs for different document views
            const dialogBody = modal.querySelector('.dialog-body');
            dialogBody.innerHTML = `
                <div class="document-tabs">
                    <button class="tab-button active" data-tab="overview">Overview</button>
                    <button class="tab-button" data-tab="content">Content</button>
                </div>
                
                <div class="tab-content active" id="overview-tab">
                    <div class="document-info-group">
                        <h4>Basic Information</h4>
                        <div class="document-info-row">
                            <div class="document-info-label">Filename</div>
                            <div class="document-info-value">${document.filename}</div>
                        </div>
                        <div class="document-info-row">
                            <div class="document-info-label">Type</div>
                            <div class="document-info-value">${fileType}</div>
                        </div>
                        <div class="document-info-row">
                            <div class="document-info-label">Size</div>
                            <div class="document-info-value">${size}</div>
                        </div>
                        <div class="document-info-row">
                            <div class="document-info-label">Uploaded</div>
                            <div class="document-info-value">${uiManager.formatDate(document.upload_date || new Date())}</div>
                        </div>
                        <div class="document-info-row">
                            <div class="document-info-label">Last Modified</div>
                            <div class="document-info-value">${uiManager.formatDate(document.last_modified_date || document.upload_date || new Date())}</div>
                        </div>
                    </div>
                    
                    <div class="document-info-group">
                        <h4>Content Information</h4>
                        <div class="document-info-row">
                            <div class="document-info-label">Word Count</div>
                            <div class="document-info-value">${document.word_count || 'N/A'}</div>
                        </div>
                        <div class="document-info-row">
                            <div class="document-info-label">Pages</div>
                            <div class="document-info-value">${document.estimated_pages || 'N/A'}</div>
                        </div>
                    </div>
                    
                    <div class="document-info-group">
                        <h4>Summary</h4>
                        <div class="document-summary">${document.content_summary || 'No summary available.'}</div>
                    </div>
                </div>
                
                <div class="tab-content" id="content-tab">
                    <div class="document-content">
                        ${document.content || 'No content available.'}
                    </div>
                </div>
            `;
            
            // Add tab switching functionality
            const tabButtons = dialogBody.querySelectorAll('.tab-button');
            const tabContents = dialogBody.querySelectorAll('.tab-content');
            
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Deactivate all tabs
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));
                    
                    // Activate selected tab
                    button.classList.add('active');
                    const tabId = button.dataset.tab + '-tab';
                    dialogBody.querySelector(`#${tabId}`).classList.add('active');
                });
            });
            
        } catch (error) {
            console.error('Error viewing document:', error);
            uiManager.showToast('Failed to load document details: ' + error.message, 'error');
            
            // Log error to connection manager
            if (window.connectionManager) {
                window.connectionManager.logConnectionEvent(`Document view error: ${error.message}`, 'error');
            }
        }
    }
    
    /**
     * Confirm deletion of a document
     * @param {string} documentId - The ID of the document to delete
     */
    confirmDeleteDocument(documentId) {
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'dialog active';
        
        confirmDialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>Confirm Deletion</h3>
                    <button class="close-dialog">&times;</button>
                </div>
                <div class="dialog-body">
                    <p>Are you sure you want to delete this document? This action cannot be undone.</p>
                </div>
                <div class="dialog-footer">
                    <button class="cancel-button">Cancel</button>
                    <button class="confirm-button danger">Delete</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmDialog);
        
        // Close button functionality
        confirmDialog.querySelector('.close-dialog').addEventListener('click', () => {
            confirmDialog.remove();
        });
        
        // Cancel button functionality
        confirmDialog.querySelector('.cancel-button').addEventListener('click', () => {
            confirmDialog.remove();
        });
        
        // Confirm button functionality
        confirmDialog.querySelector('.confirm-button').addEventListener('click', () => {
            confirmDialog.remove();
            this.deleteDocument(documentId);
        });
    }
    
    /**
     * Delete a document
     * @param {string} documentId - The ID of the document to delete
     */
    async deleteDocument(documentId) {
        try {
            // Check connection first
            if (window.connectionManager && !window.connectionManager.isConnected) {
                const connected = await window.connectionManager.checkConnection();
                if (!connected) {
                    throw new Error('Not connected to NaviTechAid server. Please check your connection.');
                }
            }
            
            const response = await fetch(`${naviTechAidAPI.baseUrl}/api/documents/${documentId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to delete document: ${response.status} ${response.statusText}`);
            }
            
            uiManager.showToast('Document deleted successfully', 'success');
            
            // Log to connection manager
            if (window.connectionManager) {
                window.connectionManager.logConnectionEvent(`Document deleted: ${documentId}`, 'info');
            }
            
            // Reload documents
            this.loadDocuments();
        } catch (error) {
            console.error('Error deleting document:', error);
            uiManager.showToast('Failed to delete document: ' + error.message, 'error');
            
            // Log error to connection manager
            if (window.connectionManager) {
                window.connectionManager.logConnectionEvent(`Document deletion error: ${error.message}`, 'error');
            }
        }
    }
}

// The documents manager will be initialized in main.js
