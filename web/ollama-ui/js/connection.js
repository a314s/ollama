/**
 * Connection management and validation for the Ollama Web UI
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
     * Check connection to the Ollama server
     * @param {boolean} userInitiated - Whether the check was initiated by the user
     * @returns {Promise<boolean>} - Whether the connection is successful
     */
    async checkConnection(userInitiated = false) {
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
            this.logConnectionEvent(`Connected to Ollama server at ${apiHost}`, 'success');
            
            // If this was a user-initiated check, show a toast
            if (userInitiated) {
                uiManager.showToast('Successfully connected to Ollama server', 'success');
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
                uiManager.showToast(`Failed to connect to Ollama server: ${errorMessage}`, 'error');
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
                this.connectionStatus.textContent = 'Connected to Ollama server';
                break;
            case 'disconnected':
                this.connectionStatus.textContent = 'Disconnected from Ollama server';
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
            return 'Server unreachable. Make sure Ollama is running and accessible.';
        } else if (error.message.includes('status: 404')) {
            // API endpoint not found
            return 'API endpoint not found. Check if you\'re using the correct API URL.';
        } else if (error.message.includes('status: 401') || error.message.includes('status: 403')) {
            // Authentication/authorization error
            return 'Authentication failed. Check your API credentials.';
        } else if (error.message.includes('status: 5')) {
            // Server error
            return 'Server error. Check Ollama server logs for details.';
        } else {
            // Other errors
            return error.message || 'Unknown error';
        }
    }
    
    /**
     * Log a connection event
     * @param {string} message - The event message
     * @param {string} level - The event level (info, success, warning, error)
     */
    logConnectionEvent(message, level = 'info') {
        const timestamp = new Date().toISOString();
        
        // Add to logs array
        this.connectionLogs.unshift({
            timestamp,
            message,
            level
        });
        
        // Limit the number of logs
        if (this.connectionLogs.length > this.maxLogs) {
            this.connectionLogs.pop();
        }
        
        // Update the logs display if the container exists
        this.updateConnectionLogs();
    }
    
    /**
     * Update the connection logs display
     */
    updateConnectionLogs() {
        if (!this.connectionLogsContainer) {
            return;
        }
        
        // Clear the container
        this.connectionLogsContainer.innerHTML = '';
        
        // Add each log entry
        this.connectionLogs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${log.level}`;
            
            const timestamp = document.createElement('span');
            timestamp.className = 'log-timestamp';
            timestamp.textContent = new Date(log.timestamp).toLocaleTimeString();
            
            logEntry.appendChild(timestamp);
            logEntry.appendChild(document.createTextNode(' ' + log.message));
            
            this.connectionLogsContainer.appendChild(logEntry);
        });
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
                        message: 'Not connected to Ollama server. Please check your connection.'
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
                    message: 'Document API is not available. Make sure you are using the latest version of Ollama.'
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
                        message: 'Not connected to Ollama server. Please check your connection.'
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
            'Make sure the Ollama server is running. You can start it by running <code>ollama serve</code> in a terminal.',
            'Check if the API host in settings is correct. The default is <code>http://localhost:11434</code>.',
            'Ensure there are no firewall or network restrictions blocking access to the Ollama server.'
        ];
        
        switch (issue) {
            case 'connection':
                return [
                    ...commonSteps,
                    'Try restarting the Ollama server.',
                    'Check the Ollama server logs for any errors or warnings.'
                ];
            
            case 'model':
                return [
                    ...commonSteps,
                    'Verify that the model is installed. You can install a model by running <code>ollama pull modelname</code> in a terminal.',
                    'Check if the model is corrupted. Try removing and reinstalling the model.',
                    'Make sure you have enough disk space for the model.'
                ];
            
            case 'chat':
                return [
                    ...commonSteps,
                    'Make sure you have selected a valid model for chat.',
                    'Check if the model is properly installed and not corrupted.',
                    'Try using a different model to see if the issue is specific to one model.',
                    'Check the Ollama server logs for any errors related to the chat API.'
                ];
            
            case 'documents':
                return [
                    ...commonSteps,
                    'Make sure you are using the latest version of Ollama that supports document processing.',
                    'Check if the document format is supported (PDF, DOC, DOCX, TXT, MD, CSV).',
                    'Ensure the document file is not corrupted or too large.',
                    'Check the Ollama server logs for any errors related to document processing.'
                ];
            
            default:
                return commonSteps;
        }
    }
}

// The connection manager will be initialized in main.js
