/**
 * Connection management and validation for the NaviTechAid Web UI
 */
class ConnectionManager {
    constructor() {
        this.connectionStatus = document.getElementById('connection-status');
        this.connectionIndicator = document.getElementById('connection-indicator');
        this.reconnectBtn = document.getElementById('reconnect-btn');
        this.connectionDetailsBtn = document.getElementById('connection-details-btn');
        this.connectionDetailsDialog = document.getElementById('connection-details-dialog');
        this.connectionLogsContainer = document.getElementById('connection-logs');
        
        this.connectionLogs = [];
        this.maxLogs = 50;
        this.isConnected = false;
        this.checkInterval = null;
        this.availableModels = [];
        
        this.init();
    }
    
    /**
     * Initialize the connection manager
     */
    init() {
        // Set up reconnect button
        if (this.reconnectBtn) {
            this.reconnectBtn.addEventListener('click', () => {
                this.checkConnection(true);
            });
        }
        
        // Set up connection details button
        if (this.connectionDetailsBtn) {
            this.connectionDetailsBtn.addEventListener('click', () => {
                this.showConnectionDetails();
            });
        }
        
        // Set up connection details dialog close button
        document.querySelectorAll('.close-dialog').forEach(button => {
            button.addEventListener('click', (e) => {
                const dialog = e.target.closest('.dialog');
                if (dialog) {
                    dialog.classList.remove('active');
                }
            });
        });
        
        // Start periodic connection check
        this.startConnectionCheck();
    }
    
    /**
     * Start periodic connection check
     */
    startConnectionCheck() {
        // Check connection immediately
        this.checkConnection();
        
        // Set up interval for periodic checks
        this.checkInterval = setInterval(() => {
            this.checkConnection();
        }, 30000); // Check every 30 seconds
    }
    
    /**
     * Stop periodic connection check
     */
    stopConnectionCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    
    /**
     * Check connection to the NaviTechAid server
     * @param {boolean} userInitiated - Whether the check was initiated by the user
     * @param {boolean} deepValidation - Whether to perform deep validation of server functionality
     * @returns {Promise<boolean>} - Whether the connection is successful
     */
    async checkConnection(userInitiated = false, deepValidation = false) {
        if (deepValidation) {
            const validationResult = await this.validateServerFunctionality(userInitiated);
            return validationResult.success;
        }
        
        try {
            // Get API host from settings
            const settings = localStorage.getItem('settings');
            let apiHost = 'http://localhost:11434';
            
            if (settings) {
                try {
                    const parsedSettings = JSON.parse(settings);
                    if (parsedSettings.apiHost) {
                        apiHost = parsedSettings.apiHost;
                    }
                } catch (error) {
                    this.logConnectionEvent('Error parsing settings', 'error');
                }
            }
            
            // Update UI to show checking status
            this.updateConnectionStatus('checking');
            
            // Try to fetch the list of models as a connection test
            const response = await fetch(`${apiHost}/api/tags`);
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Store available models
            this.availableModels = data.models || [];
            
            // Connection successful
            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.logConnectionEvent(`Connected to NaviTechAid server at ${apiHost}`, 'success');
            
            // If user initiated and successful, also do a deep validation
            if (userInitiated) {
                // Show basic success toast
                uiManager.showToast('Connected to NaviTechAid server', 'success');
                
                // Perform deep validation in the background
                this.validateServerFunctionality(true);
            }
            
            return true;
        } catch (error) {
            // Connection failed
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            
            const errorMessage = this.getConnectionErrorDetails(error);
            this.logConnectionEvent(`Connection failed: ${errorMessage}`, 'error');
            
            // If this was a user-initiated check, show a toast
            if (userInitiated) {
                uiManager.showToast(`Failed to connect to NaviTechAid server: ${errorMessage}`, 'error');
            }
            
            return false;
        }
    }
    
    /**
     * Update the connection status in the UI
     * @param {string} status - The connection status (checking, connected, disconnected)
     */
    updateConnectionStatus(status) {
        if (!this.connectionStatus || !this.connectionIndicator) {
            return;
        }
        
        // Remove all status classes
        this.connectionIndicator.classList.remove('checking', 'connected', 'disconnected');
        
        // Add the current status class
        this.connectionIndicator.classList.add(status);
        
        // Update the status text
        switch (status) {
            case 'checking':
                this.connectionStatus.textContent = 'Checking connection...';
                break;
            case 'connected':
                this.connectionStatus.textContent = 'Connected to NaviTechAid server';
                break;
            case 'disconnected':
                this.connectionStatus.textContent = 'Disconnected from NaviTechAid server';
                break;
        }
    }
    
    /**
     * Get detailed error information for connection failures
     * @param {Error} error - The error object
     * @returns {string} - Detailed error message
     */
    getConnectionErrorDetails(error) {
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            // Network error - server might be down or unreachable
            return 'Server unreachable. Make sure NaviTechAid is running and accessible.';
        } else if (error.message.includes('status: 404')) {
            // API endpoint not found
            return 'API endpoint not found. Check if you\'re using the correct API URL.';
        } else if (error.message.includes('status: 401') || error.message.includes('status: 403')) {
            // Authentication/authorization error
            return 'Authentication failed. Check your API credentials.';
        } else if (error.message.includes('status: 5')) {
            // Server error
            return 'Server error. Check NaviTechAid server logs for details.';
        } else {
            // Other errors
            return error.message || 'Unknown error';
        }
    }
    
    /**
     * Log connection event with timestamp
     * @param {string} message - Message to log
     * @param {string} type - Type of message (info, success, warning, error)
     */
    logConnectionEvent(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logItem = document.createElement('div');
        logItem.className = `log-item ${type}`;
        logItem.textContent = `${timestamp} - ${message}`;
        
        // Add to connection logs if available
        const connectionLogs = document.getElementById('connection-logs');
        if (connectionLogs) {
            connectionLogs.appendChild(logItem);
            connectionLogs.scrollTop = connectionLogs.scrollHeight;
        }
        
        // Also log to console
        console.log(`[NaviTechAid Connection] ${timestamp} - ${message}`);
    }
    
    /**
     * Show the connection details dialog
     */
    showConnectionDetails() {
        if (!this.connectionDetailsDialog) {
            return;
        }
        
        // Update the logs display
        this.updateConnectionLogs();
        
        // Show the dialog
        this.connectionDetailsDialog.classList.add('active');
    }
    
    /**
     * Check if a specific model is available
     * @param {string} modelName - The name of the model to check
     * @returns {Promise<boolean>} - Whether the model is available
     */
    async isModelAvailable(modelName) {
        // If we're not connected, return false
        if (!this.isConnected) {
            return false;
        }
        
        // If we don't have a model name, return false
        if (!modelName) {
            return false;
        }
        
        // Check if we need to refresh the model list
        if (this.availableModels.length === 0) {
            await this.checkConnection();
        }
        
        // Check if the model is in the list
        return this.availableModels.some(model => model.name === modelName);
    }
    
    /**
     * Validate document functionality
     * @returns {Promise<{success: boolean, message: string}>} - Validation result
     */
    async validateDocumentFunctionality() {
        try {
            // First check if we're connected
            if (!this.isConnected) {
                const connected = await this.checkConnection();
                if (!connected) {
                    return {
                        success: false,
                        message: 'Not connected to NaviTechAid server. Please check your connection.'
                    };
                }
            }
            
            // Check if the documents API is available
            const settings = localStorage.getItem('settings');
            let apiHost = 'http://localhost:11434';
            
            if (settings) {
                try {
                    const parsedSettings = JSON.parse(settings);
                    if (parsedSettings.apiHost) {
                        apiHost = parsedSettings.apiHost;
                    }
                } catch (error) {
                    // Ignore parsing errors
                }
            }
            
            try {
                const response = await fetch(`${apiHost}/api/documents`);
                
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                
                // Documents API is available
                return {
                    success: true,
                    message: 'Document functionality is available.'
                };
            } catch (error) {
                // Documents API is not available
                return {
                    success: false,
                    message: 'Document API is not available. Make sure you are using the latest version of NaviTechAid.'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Error validating document functionality: ${error.message}`
            };
        }
    }
    
    /**
     * Validate chat functionality
     * @param {string} modelName - The name of the model to use for chat
     * @returns {Promise<{success: boolean, message: string}>} - Validation result
     */
    async validateChatFunctionality(modelName) {
        try {
            // First check if we're connected
            if (!this.isConnected) {
                const connected = await this.checkConnection();
                if (!connected) {
                    return {
                        success: false,
                        message: 'Not connected to NaviTechAid server. Please check your connection.'
                    };
                }
            }
            
            // Check if the model is available
            if (modelName) {
                const modelAvailable = await this.isModelAvailable(modelName);
                if (!modelAvailable) {
                    return {
                        success: false,
                        message: `Model "${modelName}" is not available. Please select a different model.`
                    };
                }
            } else {
                // No model specified
                return {
                    success: false,
                    message: 'No model selected. Please select a model to use for chat.'
                };
            }
            
            // Check if the chat API is available
            const settings = localStorage.getItem('settings');
            let apiHost = 'http://localhost:11434';
            
            if (settings) {
                try {
                    const parsedSettings = JSON.parse(settings);
                    if (parsedSettings.apiHost) {
                        apiHost = parsedSettings.apiHost;
                    }
                } catch (error) {
                    // Ignore parsing errors
                }
            }
            
            try {
                // Try a simple chat request to see if the API works
                const response = await fetch(`${apiHost}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a helpful assistant.'
                            },
                            {
                                role: 'user',
                                content: 'Hello'
                            }
                        ],
                        stream: false
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Server responded with status: ${response.status}`);
                }
                
                // Chat API is available
                return {
                    success: true,
                    message: 'Chat functionality is available.'
                };
            } catch (error) {
                // Chat API is not available or there was an error
                return {
                    success: false,
                    message: `Chat API error: ${error.message}`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Error validating chat functionality: ${error.message}`
            };
        }
    }
    
    /**
     * Get troubleshooting steps for a specific issue
     * @param {string} issue - The issue to get troubleshooting steps for
     * @returns {Array<string>} - Array of troubleshooting steps
     */
    getTroubleshootingSteps(issue) {
        const commonSteps = [
            'Make sure the NaviTechAid server is running. You can start it by running <code>navitechaid serve</code> in a terminal.',
            'Check if the API host in settings is correct. The default is <code>http://localhost:11434</code>.',
            'Ensure there are no firewall or network restrictions blocking access to the NaviTechAid server.'
        ];
        
        switch (issue) {
            case 'connection':
                return [
                    ...commonSteps,
                    'Try restarting the NaviTechAid server.',
                    'Check the NaviTechAid server logs for any errors or warnings.'
                ];
            
            case 'model':
                return [
                    ...commonSteps,
                    'Verify that the model is installed. You can install a model by running <code>navitechaid pull modelname</code> in a terminal.',
                    'Check if the model is corrupted. Try removing and reinstalling the model.',
                    'Make sure you have enough disk space for the model.'
                ];
            
            case 'chat':
                return [
                    ...commonSteps,
                    'Make sure you have selected a valid model for chat.',
                    'Check if the model is properly installed and not corrupted.',
                    'Try using a different model to see if the issue is specific to one model.',
                    'Check the NaviTechAid server logs for any errors related to the chat API.'
                ];
            
            case 'documents':
                return [
                    ...commonSteps,
                    'Make sure you are using the latest version of NaviTechAid that supports document processing.',
                    'Check if the document format is supported (PDF, DOC, DOCX, TXT, MD, CSV).',
                    'Ensure the document file is not corrupted or too large.',
                    'Check the NaviTechAid server logs for any errors related to document processing.'
                ];
            
            default:
                return commonSteps;
        }
    }
    
    /**
     * Deep validation of server functionality
     * @param {boolean} userInitiated - Whether the check was initiated by the user
     * @returns {Promise<{success: boolean, details: object}>} - Validation result with details
     */
    async validateServerFunctionality(userInitiated = false) {
        try {
            // First check basic connection
            const connected = await this.checkConnection(false);
            if (!connected) {
                return {
                    success: false,
                    details: {
                        connection: false,
                        models: false,
                        chat: false,
                        documents: false
                    }
                };
            }
            
            // Get API host from settings
            const settings = localStorage.getItem('settings');
            let apiHost = 'http://localhost:11434';
            
            if (settings) {
                try {
                    const parsedSettings = JSON.parse(settings);
                    if (parsedSettings.apiHost) {
                        apiHost = parsedSettings.apiHost;
                    }
                } catch (error) {
                    console.error('Error parsing settings:', error);
                }
            }
            
            // Test models listing functionality
            let modelsWorking = false;
            let availableModels = [];
            try {
                const modelsResponse = await fetch(`${apiHost}/api/tags`);
                if (modelsResponse.ok) {
                    const modelsData = await modelsResponse.json();
                    availableModels = modelsData.models || [];
                    modelsWorking = availableModels.length > 0;
                    
                    // Update stored models
                    this.availableModels = availableModels;
                }
            } catch (error) {
                this.logConnectionEvent(`Models API failed: ${error.message}`, 'error');
            }
            
            // Test chat functionality with a simple query to the first available model
            let chatWorking = false;
            if (modelsWorking && availableModels.length > 0) {
                try {
                    const modelName = availableModels[0].name;
                    const chatTestResponse = await fetch(`${apiHost}/api/generate`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: modelName,
                            prompt: 'Hello, can you respond with the word "working" to test connectivity?',
                            stream: false
                        })
                    });
                    
                    if (chatTestResponse.ok) {
                        const chatData = await chatTestResponse.json();
                        chatWorking = chatData && chatData.response && chatData.response.length > 0;
                    }
                } catch (error) {
                    this.logConnectionEvent(`Chat API failed: ${error.message}`, 'error');
                }
            }
            
            // Test documents functionality (if available)
            let documentsWorking = false;
            try {
                const documentsResponse = await fetch(`${apiHost}/api/embeddings`);
                documentsWorking = documentsResponse.ok;
            } catch (error) {
                this.logConnectionEvent(`Documents API failed: ${error.message}`, 'warning');
                // Documents API might not be available in all NaviTechAid versions
                // so this failure is less critical
            }
            
            const result = {
                success: modelsWorking && chatWorking,
                details: {
                    connection: true,
                    models: modelsWorking,
                    chat: chatWorking,
                    documents: documentsWorking
                }
            };
            
            // Log overall status
            if (result.success) {
                this.logConnectionEvent(`Server functionality validated successfully`, 'success');
                this.isConnected = true;
                this.updateConnectionStatus('connected');
                
                if (userInitiated) {
                    uiManager.showToast('Server is fully operational', 'success');
                }
            } else {
                // We have a connection but functionality is limited
                this.logConnectionEvent(`Server connected but has limited functionality`, 'warning');
                this.isConnected = true; // Still connected but with issues
                this.updateConnectionStatus('connected');
                
                // Create a detailed message about what's not working
                let issues = [];
                if (!result.details.models) issues.push('Models listing not working');
                if (!result.details.chat) issues.push('Chat functionality not working');
                if (!result.details.documents) issues.push('Document processing not working');
                
                if (userInitiated) {
                    uiManager.showToast(`Server connected but has issues: ${issues.join(', ')}`, 'warning');
                }
            }
            
            return result;
        } catch (error) {
            this.logConnectionEvent(`Validation failed: ${error.message}`, 'error');
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            
            if (userInitiated) {
                uiManager.showToast(`Server validation failed: ${error.message}`, 'error');
            }
            
            return {
                success: false,
                details: {
                    connection: false,
                    models: false,
                    chat: false,
                    documents: false
                }
            };
        }
    }
    
    /**
     * Get common troubleshooting steps based on issue type
     * @param {string} type - Type of issue (api, connection, models, etc.)
     * @returns {string[]} - Array of troubleshooting steps
     */
    getCommonTroubleshootingSteps(type = 'connection') {
        const commonSteps = [
            "Ensure NaviTechAid server is running on your machine or the specified host.",
            "Check that the API URL in settings is correct (default: http://localhost:11434).",
            "Verify your network connection and firewall settings.",
            "Restart the NaviTechAid server if it's unresponsive."
        ];
        
        switch (type) {
            case 'api':
                return [
                    ...commonSteps,
                    "Check that the NaviTechAid server version is compatible with this UI.",
                    "Ensure you have the necessary permissions to access the API.",
                    "Look for any error messages in the browser console or server logs."
                ];
            case 'models':
                return [
                    ...commonSteps,
                    "Verify you have at least one model downloaded.",
                    "Try running 'navitechaid list' in the command line to see available models.",
                    "If no models are listed, try pulling one with 'navitechaid pull modelname'."
                ];
            case 'chat':
                return [
                    ...commonSteps,
                    "Ensure the selected model is properly loaded.",
                    "Check if the model is compatible with the chat format.",
                    "Try a different model to see if the issue is model-specific."
                ];
            case 'documents':
                return [
                    ...commonSteps,
                    "Check that the document format is supported.",
                    "Ensure the document is not too large for processing.",
                    "Verify that the document embedding functionality is working."
                ];
            default:
                return commonSteps;
        }
    }
}

// The connection manager will be initialized in main.js
