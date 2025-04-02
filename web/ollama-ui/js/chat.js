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
        this.modelSelect.addEventListener('change', () => {
            this.currentModel = this.modelSelect.value;
            this.sendButton.disabled = !this.currentModel;
            localStorage.setItem('currentModel', this.currentModel);
            
            // Validate chat functionality with the selected model
            this.validateChatFunctionality();
        });
        
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
     * Load available models for the dropdown
     */
    async loadModels() {
        try {
            // First check connection
            if (connectionManager && !connectionManager.isConnected) {
                await connectionManager.checkConnection();
            }
            
            const models = await ollamaAPI.listModels();
            
            // Clear the dropdown
            this.modelSelect.innerHTML = '';
            
            if (models.length === 0) {
                this.modelSelect.innerHTML = '<option value="">No models available</option>';
                this.appendMessage('No models are available. Please check your Ollama installation.', 'system error');
                return;
            }
            
            // Add models to the dropdown
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                this.modelSelect.appendChild(option);
            });
            
            // Set the current model from localStorage or use the first model
            const savedModel = localStorage.getItem('currentModel');
            if (savedModel && models.some(model => model.name === savedModel)) {
                this.modelSelect.value = savedModel;
                this.currentModel = savedModel;
            } else if (models.length > 0) {
                this.modelSelect.value = models[0].name;
                this.currentModel = models[0].name;
            }
            
            // Enable/disable send button based on model selection
            this.sendButton.disabled = !this.currentModel;
            
            // Validate chat functionality with the selected model
            this.validateChatFunctionality();
            
        } catch (error) {
            console.error('Error loading models:', error);
            uiManager.showToast('Failed to load models. Please check your connection.', 'error');
            this.modelSelect.innerHTML = '<option value="">Error loading models</option>';
            this.appendMessage('Failed to load models. Please check your connection to the Ollama server.', 'system error');
        }
    }
    
    /**
     * Validate chat functionality with the current model
     */
    async validateChatFunctionality() {
        if (!this.currentModel || !connectionManager) {
            return;
        }
        
        const result = await connectionManager.validateChatFunctionality(this.currentModel);
        
        if (!result.success) {
            this.appendMessage(`Chat validation failed: ${result.message}`, 'system error');
            uiManager.showToast(result.message, 'error');
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
