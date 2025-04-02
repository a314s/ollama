/**
 * Main entry point for the NaviTechAid Web UI
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize API client
    const naviTechAidAPI = new NaviTechAidAPI();
    window.naviTechAidAPI = naviTechAidAPI;
    
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
        console.log("Setting up navigation...");
        
        // Set up sidebar navigation with direct event binding
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        console.log(`Found ${navItems.length} navigation items`);
        
        navItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const page = this.getAttribute('data-page');
                console.log(`Navigation item clicked: ${page}`);
                
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
     * Create the NaviTechAid logo SVG if it doesn't exist
     */
    function createLogoIfNeeded() {
        const logoDir = 'assets';
        const logoPath = `${logoDir}/navitechaid-logo.svg`;
        
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

/**
 * UI Manager class for handling UI interactions
 */
class UIManager {
    constructor() {
        this.toastContainer = document.getElementById('toast-container');
        this.toastTimeout = null;
        this.toastDuration = 3000; // 3 seconds
        
        // Initialize theme
        this.initTheme();
    }
    
    /**
     * Initialize theme based on user preference or system preference
     */
    initTheme() {
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            // Check for system preference
            const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDarkMode ? 'dark' : 'light');
        }
        
        // Set up theme toggle button
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }
    
    /**
     * Toggle between light and dark theme
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Show toast notification
        this.showToast(`Switched to ${newTheme} theme`, 'info');
    }
    
    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of toast (success, error, info, warning)
     */
    showToast(message, type = 'info') {
        if (!this.toastContainer) return;
        
        // Clear any existing toast
        clearTimeout(this.toastTimeout);
        this.toastContainer.innerHTML = '';
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-toast';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => {
            toast.remove();
        });
        
        toast.appendChild(closeBtn);
        this.toastContainer.appendChild(toast);
        
        // Auto-remove after duration
        this.toastTimeout = setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, this.toastDuration);
    }
    
    /**
     * Show a page
     * @param {string} pageId - ID of the page element
     */
    showPage(pageId) {
        console.log(`Showing page: ${pageId}`);
        
        // Remove active class from all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Remove active class from all sidebar navigation items
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to the current page
        const page = document.getElementById(`${pageId}-page`);
        if (page) {
            console.log(`Activating page: ${pageId}-page`);
            page.classList.add('active');
        } else {
            console.error(`Page not found: ${pageId}-page`);
        }
        
        // Add active class to the current sidebar navigation item
        const navItem = document.querySelector(`.sidebar-nav .nav-item[data-page="${pageId}"]`);
        if (navItem) {
            console.log(`Activating nav item for: ${pageId}`);
            navItem.classList.add('active');
        } else {
            console.error(`Navigation item not found for page: ${pageId}`);
        }
    }
}

/**
 * API class for interacting with the NaviTechAid server
 */
class NaviTechAidAPI {
    constructor() {
        this.baseUrl = 'http://localhost:11434';
        this.loadSettings();
    }
    
    /**
     * Load API settings from localStorage
     */
    loadSettings() {
        const settings = localStorage.getItem('settings');
        if (settings) {
            try {
                const parsedSettings = JSON.parse(settings);
                if (parsedSettings.apiHost) {
                    this.baseUrl = parsedSettings.apiHost;
                }
            } catch (error) {
                console.error('Error parsing settings:', error);
            }
        }
    }
    
    /**
     * List available models
     * @returns {Promise<Array>} - List of models
     */
    async listModels() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            
            if (!response.ok) {
                throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('Error listing models:', error);
            return [];
        }
    }
    
    /**
     * Generate a response from the model
     * @param {string} model - Model name
     * @param {string} prompt - User prompt
     * @param {boolean} stream - Whether to stream the response
     * @param {Object} options - Additional options
     * @returns {Promise<Response>} - Fetch response object
     */
    async generateResponse(model, prompt, stream = true, options = {}) {
        try {
            return await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    prompt,
                    stream,
                    ...options
                })
            });
        } catch (error) {
            console.error('Error generating response:', error);
            throw error;
        }
    }
}
