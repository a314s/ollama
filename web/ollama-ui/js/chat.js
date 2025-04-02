/**
 * Chat functionality for the Ollama Web UI
 */
class ChatManager {
    constructor() {
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-button');
        this.modelSelect = document.getElementById('model-select');
        this.troubleshootBtn = document.getElementById('chat-troubleshoot-btn');
        
        this.currentModel = '';
        this.isProcessing = false;
        this.messageHistory = [];
        
        this.init();
    }
    
    /**
     * Initialize the chat functionality
     */
    init() {
        // Load models for the dropdown
        this.loadModels();
        
        // Handle model selection
        this.modelSelect.addEventListener('change', (event) => this.handleModelSelection(event));
        
        // Handle message sending
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.chatInput.addEventListener('input', () => {
            this.chatInput.style.height = 'auto';
            this.chatInput.style.height = this.chatInput.scrollHeight + 'px';
        });
        
        // Set up troubleshoot button
        if (this.troubleshootBtn) {
            this.troubleshootBtn.addEventListener('click', () => {
                this.showTroubleshootingSteps();
            });
        }
        
        // Load chat history from localStorage
        this.loadChatHistory();
    }
    
    /**
     * Load available models from the server
     */
    async loadModels() {
        try {
            // First check if we have a connection and valid models
            if (!window.connectionManager || !window.connectionManager.isConnected) {
                this.displayModelLoadingError("Not connected to Ollama server");
                return;
            }
            
            // Clear existing options
            while (this.modelSelect.firstChild) {
                this.modelSelect.removeChild(this.modelSelect.firstChild);
            }
            
            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = 'Loading models...';
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            this.modelSelect.appendChild(placeholderOption);
            
            // Fetch available models
            const response = await fetch(`${ollamaAPI.baseUrl}/api/tags`);
            
            if (!response.ok) {
                throw new Error(`Failed to load models: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            const models = data.models || [];
            
            if (models.length === 0) {
                this.displayModelLoadingError("No models available");
                return;
            }
            
            // Remove placeholder
            this.modelSelect.removeChild(placeholderOption);
            
            // Add models to dropdown
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                this.modelSelect.appendChild(option);
            });
            
            // Add option for custom model
            const customOption = document.createElement('option');
            customOption.value = "custom";
            customOption.textContent = "➕ Add Custom Model";
            customOption.classList.add('custom-model-option');
            this.modelSelect.appendChild(customOption);
            
            // Set previously selected model if available
            const savedModel = localStorage.getItem('currentModel');
            if (savedModel && models.some(model => model.name === savedModel)) {
                this.modelSelect.value = savedModel;
                this.currentModel = savedModel;
            } else {
                // Set first available model as default
                this.modelSelect.value = models[0].name;
                this.currentModel = models[0].name;
            }
            
            // Enable send button if a model is selected
            this.sendButton.disabled = !this.currentModel || this.currentModel === 'custom';
            
        } catch (error) {
            this.displayModelLoadingError(error.message);
            console.error('Error loading models:', error);
        }
    }
    
    /**
     * Display error when models can't be loaded
     * @param {string} errorMessage - Error message to display
     */
    displayModelLoadingError(errorMessage) {
        // Clear existing options
        while (this.modelSelect.firstChild) {
            this.modelSelect.removeChild(this.modelSelect.firstChild);
        }
        
        // Add error option
        const errorOption = document.createElement('option');
        errorOption.value = '';
        errorOption.textContent = `Error: ${errorMessage}`;
        errorOption.disabled = true;
        errorOption.selected = true;
        this.modelSelect.appendChild(errorOption);
        
        // Disable send button
        this.sendButton.disabled = true;
        
        // Add refresh option
        const refreshOption = document.createElement('option');
        refreshOption.value = 'refresh';
        refreshOption.textContent = '🔄 Refresh Models';
        this.modelSelect.appendChild(refreshOption);
    }
    
    /**
     * Handle model selection change
     * @param {Event} event - Change event
     */
    handleModelSelection(event) {
        const selectedValue = event.target.value;
        
        if (selectedValue === 'refresh') {
            // User wants to refresh the model list
            this.loadModels();
            return;
        }
        
        if (selectedValue === 'custom') {
            // User wants to add a custom model
            this.promptForCustomModel();
            return;
        }
        
        // Regular model selection
        this.currentModel = selectedValue;
        localStorage.setItem('currentModel', this.currentModel);
        this.sendButton.disabled = !this.currentModel;
        
        // Validate chat functionality with the selected model
        this.validateChatFunctionality();
    }
    
    /**
     * Prompt user to add a custom model
     */
    async promptForCustomModel() {
        // Ask for model name
        const modelName = prompt("Enter the exact name of the model (e.g., llama2:latest):");
        
        if (!modelName) {
            // User canceled, revert to previous selection
            const savedModel = localStorage.getItem('currentModel');
            if (savedModel) {
                this.modelSelect.value = savedModel;
            } else {
                this.modelSelect.selectedIndex = 0;
            }
            return;
        }
        
        // Check if model name is valid
        if (!modelName.match(/^[a-zA-Z0-9._-]+:[a-zA-Z0-9._-]+$/) && 
            !modelName.match(/^[a-zA-Z0-9._-]+$/)) {
            alert("Invalid model format. Use format 'modelname:tag' or 'modelname'");
            
            // Revert to previous selection
            const savedModel = localStorage.getItem('currentModel');
            if (savedModel) {
                this.modelSelect.value = savedModel;
            } else {
                this.modelSelect.selectedIndex = 0;
            }
            return;
        }
        
        // Check if this model exists by making a quick request
        try {
            uiManager.showToast(`Checking if model ${modelName} exists...`, 'info');
            
            const response = await fetch(`${ollamaAPI.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelName,
                    prompt: "Hi",
                    stream: false
                })
            });
            
            if (response.ok) {
                // Model exists, add it to the dropdown
                const option = document.createElement('option');
                option.value = modelName;
                option.textContent = modelName;
                
                // Insert before the custom option
                const customOptionIndex = Array.from(this.modelSelect.options)
                    .findIndex(opt => opt.value === 'custom');
                
                if (customOptionIndex > -1) {
                    this.modelSelect.insertBefore(option, this.modelSelect.options[customOptionIndex]);
                } else {
                    this.modelSelect.insertBefore(option, this.modelSelect.lastChild);
                }
                
                // Select the new model
                this.modelSelect.value = modelName;
                this.currentModel = modelName;
                localStorage.setItem('currentModel', this.currentModel);
                this.sendButton.disabled = false;
                
                uiManager.showToast(`Model ${modelName} added successfully!`, 'success');
            } else {
                // Model doesn't exist
                const errorData = await response.json();
                throw new Error(errorData.error || `Model ${modelName} not found`);
            }
        } catch (error) {
            console.error("Error checking model:", error);
            alert(`Error: ${error.message || "Failed to check if model exists"}. Check if the model exists on your Ollama server. You might need to pull it first using "ollama pull ${modelName}" in the terminal.`);
            
            // Revert to previous selection
            const savedModel = localStorage.getItem('currentModel');
            if (savedModel) {
                this.modelSelect.value = savedModel;
            } else {
                this.modelSelect.selectedIndex = 0;
            }
        }
    }
    
    /**
     * Validate chat functionality with the current model
     */
    async validateChatFunctionality() {
        if (!this.currentModel) return;
        
        try {
            this.addMessage({
                role: 'system',
                content: `Validating chat functionality with model: ${this.currentModel}...`
            }, false);
            
            // Make a simple request to check if the model works
            const response = await fetch(`${ollamaAPI.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.currentModel,
                    prompt: "Say 'Hello, I'm working!' if you can respond.",
                    stream: false
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Model ${this.currentModel} returned an error`);
            }
            
            const data = await response.json();
            
            if (data && data.response) {
                this.addMessage({
                    role: 'system',
                    content: `✓ Model ${this.currentModel} is working correctly!`
                }, false);
            } else {
                throw new Error(`Model ${this.currentModel} returned an empty response`);
            }
        } catch (error) {
            console.error("Error validating model:", error);
            this.addMessage({
                role: 'system',
                content: `⚠️ Error validating model ${this.currentModel}: ${error.message}`,
                type: 'error'
            }, false);
            
            // Show troubleshooting button
            const troubleshootBtn = document.createElement('button');
            troubleshootBtn.className = 'button secondary';
            troubleshootBtn.textContent = 'Troubleshoot';
            troubleshootBtn.addEventListener('click', () => {
                const dialog = document.getElementById('chat-troubleshooting-dialog');
                if (dialog) {
                    dialog.classList.add('active');
                }
            });
            
            const lastMessage = this.chatMessages.lastElementChild;
            if (lastMessage) {
                lastMessage.appendChild(troubleshootBtn);
            }
        }
    }
    
    /**
     * Show troubleshooting steps for chat issues
     */
    showTroubleshootingSteps() {
        if (!connectionManager) {
            return;
        }
        
        const steps = connectionManager.getTroubleshootingSteps('chat');
        
        let stepsHtml = '<ul class="troubleshooting-steps">';
        steps.forEach(step => {
            stepsHtml += `<li>${step}</li>`;
        });
        stepsHtml += '</ul>';
        
        this.appendMessage('Troubleshooting steps for chat issues:', 'system');
        this.appendMessage(stepsHtml, 'system');
    }
    
    /**
     * Load chat history from localStorage
     */
    loadChatHistory() {
        const history = localStorage.getItem('chatHistory');
        if (history) {
            try {
                this.messageHistory = JSON.parse(history);
                
                // Display the messages
                this.chatMessages.innerHTML = '';
                this.messageHistory.forEach(msg => {
                    this.appendMessage(msg.content, msg.role);
                });
                
                // Scroll to bottom
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            } catch (error) {
                console.error('Error loading chat history:', error);
                this.messageHistory = [];
            }
        } else {
            // Add welcome message if no history
            this.appendMessage('Hello! I\'m your Ollama assistant. Select a model and start chatting!', 'system');
        }
    }
    
    /**
     * Save chat history to localStorage
     */
    saveChatHistory() {
        localStorage.setItem('chatHistory', JSON.stringify(this.messageHistory));
    }
    
    /**
     * Clear the chat history
     */
    clearChatHistory() {
        this.messageHistory = [];
        this.chatMessages.innerHTML = '';
        localStorage.removeItem('chatHistory');
        
        // Add welcome message
        this.appendMessage('Hello! I\'m your Ollama assistant. Select a model and start chatting!', 'system');
    }
    
    /**
     * Send a message to the model
     */
    async sendMessage() {
        if (this.isProcessing || !this.chatInput.value.trim() || !this.currentModel) {
            return;
        }
        
        const message = this.chatInput.value.trim();
        this.chatInput.value = '';
        this.chatInput.style.height = 'auto';
        
        // Display user message
        this.appendMessage(message, 'user');
        
        // Add to message history
        this.messageHistory.push({
            role: 'user',
            content: message
        });
        
        this.isProcessing = true;
        
        try {
            // Check connection first
            if (connectionManager && !connectionManager.isConnected) {
                const connected = await connectionManager.checkConnection();
                if (!connected) {
                    throw new Error('Not connected to Ollama server. Please check your connection.');
                }
            }
            
            // Validate model availability
            if (connectionManager) {
                const modelAvailable = await connectionManager.isModelAvailable(this.currentModel);
                if (!modelAvailable) {
                    throw new Error(`Model "${this.currentModel}" is not available. Please select a different model.`);
                }
            }
            
            // Show typing indicator
            const typingIndicator = uiManager.createTypingIndicator();
            this.chatMessages.appendChild(typingIndicator);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            
            // Prepare messages for the API
            const messages = this.messageHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            
            // Get response from API
            let responseText = '';
            await ollamaAPI.chat({
                model: this.currentModel,
                messages: messages
            }, (chunk) => {
                // Update response as it streams in
                if (chunk.message && chunk.message.content) {
                    responseText = chunk.message.content;
                    this.updateLastMessage(responseText);
                }
            });
            
            // Remove typing indicator
            typingIndicator.remove();
            
            if (!responseText) {
                throw new Error('Empty response from server');
            }
            
            // Add the final response to the message history
            this.messageHistory.push({
                role: 'assistant',
                content: responseText
            });
            
            // Save chat history
            this.saveChatHistory();
            
        } catch (error) {
            console.error('Error sending message:', error);
            
            // Remove typing indicator if it exists
            const typingIndicator = this.chatMessages.querySelector('.typing');
            if (typingIndicator) {
                typingIndicator.remove();
            }
            
            // Show error message with troubleshooting option
            const errorMessage = error.message || 'An unknown error occurred';
            this.appendMessage(`Error: ${errorMessage}`, 'system error');
            
            // Add troubleshooting suggestion
            this.appendMessage('Click the "Troubleshoot" button for help resolving this issue.', 'system');
            
            // Log the error to connection manager if available
            if (connectionManager) {
                connectionManager.logConnectionEvent(`Chat error: ${errorMessage}`, 'error');
            }
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Append a message to the chat
     * @param {string} content - The message content
     * @param {string} role - The role of the sender ('user', 'assistant', 'system')
     */
    appendMessage(content, role = 'system') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${uiManager.formatMessage(content)}</p>
            </div>
        `;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        return messageDiv;
    }
    
    /**
     * Update the last message in the chat
     * @param {string} content - The new content for the message
     */
    updateLastMessage(content) {
        const lastMessage = this.chatMessages.querySelector('.message:last-child');
        if (lastMessage && !lastMessage.classList.contains('typing')) {
            lastMessage.querySelector('p').innerHTML = uiManager.formatMessage(content);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
}

// The chat manager will be initialized in main.js
