/**
 * Main entry point for the Ollama Web UI
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize API client
    const ollamaAPI = new OllamaAPI();
    window.ollamaAPI = ollamaAPI;
    
    // Initialize UI manager
    const uiManager = new UIManager();
    window.uiManager = uiManager;
    
    // Initialize connection manager first
    const connectionManager = new ConnectionManager();
    window.connectionManager = connectionManager;
    
    // Initialize other managers after connection is established
    const chatManager = new ChatManager();
    const modelsManager = new ModelsManager();
    const documentsManager = new DocumentsManager();
    const settingsManager = new SettingsManager();
    
    // Set up navigation
    setupNavigation();
    
    // Set up clear chat button
    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the chat history?')) {
                chatManager.clearChatHistory();
            }
        });
    }
    
    // Set up troubleshoot buttons
    setupTroubleshootButtons();
    
    // Update version display
    document.querySelector('.version').textContent = `v${CONFIG.version}`;
    
    /**
     * Set up navigation between pages
     */
    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) {
                    uiManager.showPage(page);
                    
                    // Update URL hash
                    window.location.hash = page;
                    
                    // Perform page-specific actions
                    handlePageChange(page);
                }
            });
        });
        
        // Handle initial page based on URL hash
        const hash = window.location.hash.substring(1);
        if (hash && document.getElementById(`${hash}-page`)) {
            uiManager.showPage(hash);
            handlePageChange(hash);
        } else {
            // Default to chat page
            uiManager.showPage('chat');
            handlePageChange('chat');
        }
        
        // Handle hash change
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.substring(1);
            if (hash && document.getElementById(`${hash}-page`)) {
                uiManager.showPage(hash);
                handlePageChange(hash);
            }
        });
    }
    
    /**
     * Set up troubleshoot buttons
     */
    function setupTroubleshootButtons() {
        // Chat troubleshoot button
        const chatTroubleshootBtn = document.getElementById('chat-troubleshoot-btn');
        if (chatTroubleshootBtn) {
            chatTroubleshootBtn.addEventListener('click', () => {
                const dialog = document.getElementById('chat-troubleshooting-dialog');
                if (dialog) {
                    dialog.classList.add('active');
                }
            });
        }
        
        // Documents troubleshoot button
        const documentsTroubleshootBtn = document.getElementById('documents-troubleshoot-btn');
        if (documentsTroubleshootBtn) {
            documentsTroubleshootBtn.addEventListener('click', () => {
                const dialog = document.getElementById('documents-troubleshooting-dialog');
                if (dialog) {
                    dialog.classList.add('active');
                }
            });
        }
        
        // Check chat connection button
        const checkChatConnectionBtn = document.getElementById('check-chat-connection-btn');
        if (checkChatConnectionBtn) {
            checkChatConnectionBtn.addEventListener('click', () => {
                connectionManager.checkConnection(true);
            });
        }
        
        // Check documents connection button
        const checkDocumentsConnectionBtn = document.getElementById('check-documents-connection-btn');
        if (checkDocumentsConnectionBtn) {
            checkDocumentsConnectionBtn.addEventListener('click', () => {
                connectionManager.checkConnection(true);
            });
        }
        
        // Check connection button in connection details dialog
        const checkConnectionBtn = document.getElementById('check-connection-btn');
        if (checkConnectionBtn) {
            checkConnectionBtn.addEventListener('click', () => {
                connectionManager.checkConnection(true);
            });
        }
    }
    
    /**
     * Handle page-specific actions when changing pages
     * @param {string} page - The page to show
     */
    function handlePageChange(page) {
        // Check connection when changing pages
        if (connectionManager) {
            connectionManager.checkConnection();
        }
        
        // Page-specific actions
        switch (page) {
            case 'chat':
                // Refresh models when navigating to chat page
                chatManager.loadModels();
                break;
                
            case 'documents':
                // Refresh documents when navigating to documents page
                documentsManager.loadDocuments();
                break;
                
            case 'models':
                // Refresh models when navigating to models page
                modelsManager.loadModels();
                break;
                
            case 'settings':
                // Refresh settings when navigating to settings page
                settingsManager.loadSettings();
                break;
        }
    }
    
    // Create a logo SVG if it doesn't exist
    createLogoIfNeeded();
    
    /**
     * Create the Ollama logo SVG if it doesn't exist
     */
    function createLogoIfNeeded() {
        const logoDir = 'assets';
        const logoPath = `${logoDir}/ollama-logo.svg`;
        
        // Create a simple placeholder logo
        const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect width="100" height="100" rx="20" fill="#4f46e5"/>
            <path d="M30 30 L70 30 L70 70 L30 70 Z" stroke="white" stroke-width="6" fill="none"/>
            <circle cx="50" cy="50" r="15" fill="white"/>
        </svg>`;
        
        // Check if assets directory exists
        fetch(logoDir)
            .catch(() => {
                // Create assets directory if it doesn't exist
                return fetch(logoDir, { method: 'MKCOL' });
            })
            .finally(() => {
                // Check if logo exists
                fetch(logoPath)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Logo not found');
                        }
                    })
                    .catch(() => {
                        // Create logo if it doesn't exist
                        fetch(logoPath, {
                            method: 'PUT',
                            body: logoSvg,
                            headers: {
                                'Content-Type': 'image/svg+xml'
                            }
                        }).catch(error => {
                            console.error('Error creating logo:', error);
                        });
                    });
            });
    }
});
