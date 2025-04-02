/**
 * Models management functionality for the Ollama Web UI
 */
class ModelsManager {
    constructor() {
        this.modelsList = document.getElementById('models-list');
        this.pullModelBtn = document.getElementById('pull-model-btn');
        this.createModelBtn = document.getElementById('create-model-btn');
        this.pullModelDialog = document.getElementById('pull-model-dialog');
        this.createModelDialog = document.getElementById('create-model-dialog');
        
        this.init();
    }
    
    /**
     * Initialize the models management functionality
     */
    init() {
        // Load models
        this.loadModels();
        
        // Set up pull model dialog
        this.pullModelBtn.addEventListener('click', () => {
            uiManager.showDialog('pull-model-dialog');
        });
        
        // Set up create model dialog
        this.createModelBtn.addEventListener('click', () => {
            this.loadBaseModels();
            uiManager.showDialog('create-model-dialog');
        });
        
        // Handle dialog close buttons
        document.querySelectorAll('.close-dialog, .cancel-dialog').forEach(button => {
            button.addEventListener('click', (e) => {
                const dialog = e.target.closest('.dialog');
                if (dialog) {
                    dialog.classList.remove('active');
                }
            });
        });
        
        // Handle pull model confirmation
        document.getElementById('confirm-pull').addEventListener('click', () => {
            this.pullModel();
        });
        
        // Handle create model confirmation
        document.getElementById('confirm-create').addEventListener('click', () => {
            this.createModel();
        });
        
        // Set up event delegation for model actions
        this.modelsList.addEventListener('click', (e) => {
            // Handle chat button
            if (e.target.classList.contains('chat-with-model')) {
                const modelName = e.target.dataset.model;
                this.chatWithModel(modelName);
            }
            
            // Handle delete button
            if (e.target.classList.contains('delete-model')) {
                const modelName = e.target.dataset.model;
                this.confirmDeleteModel(modelName);
            }
        });
    }
    
    /**
     * Load available models
     */
    async loadModels() {
        try {
            this.modelsList.innerHTML = '<div class="loading">Loading models...</div>';
            
            const models = await ollamaAPI.listModels();
            
            if (models.length === 0) {
                this.modelsList.innerHTML = '<div class="empty-state">No models available. Pull a model to get started.</div>';
                return;
            }
            
            // Clear the list
            this.modelsList.innerHTML = '';
            
            // Add models to the list
            models.forEach(model => {
                const modelCard = uiManager.createModelCard(model);
                this.modelsList.appendChild(modelCard);
            });
            
        } catch (error) {
            console.error('Error loading models:', error);
            this.modelsList.innerHTML = '<div class="error-state">Failed to load models. Please check your connection to the Ollama server.</div>';
            uiManager.showToast('Failed to load models', 'error');
        }
    }
    
    /**
     * Load base models for the create model dialog
     */
    async loadBaseModels() {
        try {
            const baseModelSelect = document.getElementById('base-model');
            baseModelSelect.innerHTML = '<option value="">Loading models...</option>';
            
            const models = await ollamaAPI.listModels();
            
            if (models.length === 0) {
                baseModelSelect.innerHTML = '<option value="">No models available</option>';
                return;
            }
            
            // Clear the dropdown
            baseModelSelect.innerHTML = '<option value="">Select a base model</option>';
            
            // Add models to the dropdown
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                baseModelSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error loading base models:', error);
            document.getElementById('base-model').innerHTML = '<option value="">Error loading models</option>';
        }
    }
    
    /**
     * Pull a model from the Ollama library
     */
    async pullModel() {
        const modelNameInput = document.getElementById('model-name');
        const modelName = modelNameInput.value.trim();
        
        if (!modelName) {
            uiManager.showToast('Please enter a model name', 'warning');
            return;
        }
        
        try {
            // Hide the dialog
            uiManager.hideDialog('pull-model-dialog');
            
            // Show a toast
            uiManager.showToast(`Pulling model: ${modelName}. This may take a while...`, 'success', 5000);
            
            // Pull the model
            await ollamaAPI.pullModel(modelName, (progress) => {
                console.log('Pull progress:', progress);
                // Could update a progress indicator here
            });
            
            // Reload models
            this.loadModels();
            
            // Show success toast
            uiManager.showToast(`Successfully pulled model: ${modelName}`, 'success');
            
            // Clear the input
            modelNameInput.value = '';
            
        } catch (error) {
            console.error('Error pulling model:', error);
            uiManager.showToast(`Failed to pull model: ${error.message}`, 'error');
        }
    }
    
    /**
     * Create a custom model
     */
    async createModel() {
        const customModelName = document.getElementById('custom-model-name').value.trim();
        const baseModel = document.getElementById('base-model').value;
        const systemPrompt = document.getElementById('system-prompt').value.trim();
        const parameters = document.getElementById('parameters').value.trim();
        
        if (!customModelName) {
            uiManager.showToast('Please enter a name for your custom model', 'warning');
            return;
        }
        
        if (!baseModel) {
            uiManager.showToast('Please select a base model', 'warning');
            return;
        }
        
        try {
            // Hide the dialog
            uiManager.hideDialog('create-model-dialog');
            
            // Construct the Modelfile
            let modelfile = `FROM ${baseModel}\n`;
            
            if (systemPrompt) {
                modelfile += `SYSTEM ${JSON.stringify(systemPrompt)}\n`;
            }
            
            if (parameters) {
                // Add each parameter on a new line
                const paramLines = parameters.split('\n');
                paramLines.forEach(line => {
                    if (line.trim()) {
                        modelfile += `PARAMETER ${line.trim()}\n`;
                    }
                });
            }
            
            // Show a toast
            uiManager.showToast(`Creating model: ${customModelName}. This may take a moment...`, 'success', 5000);
            
            // Create the model
            await ollamaAPI.createModel(customModelName, modelfile, (progress) => {
                console.log('Create progress:', progress);
                // Could update a progress indicator here
            });
            
            // Reload models
            this.loadModels();
            
            // Show success toast
            uiManager.showToast(`Successfully created model: ${customModelName}`, 'success');
            
            // Clear the inputs
            document.getElementById('custom-model-name').value = '';
            document.getElementById('base-model').value = '';
            document.getElementById('system-prompt').value = '';
            document.getElementById('parameters').value = '';
            
        } catch (error) {
            console.error('Error creating model:', error);
            uiManager.showToast(`Failed to create model: ${error.message}`, 'error');
        }
    }
    
    /**
     * Confirm deletion of a model
     * @param {string} modelName - The name of the model to delete
     */
    confirmDeleteModel(modelName) {
        if (confirm(`Are you sure you want to delete the model "${modelName}"?`)) {
            this.deleteModel(modelName);
        }
    }
    
    /**
     * Delete a model
     * @param {string} modelName - The name of the model to delete
     */
    async deleteModel(modelName) {
        try {
            // Show a toast
            uiManager.showToast(`Deleting model: ${modelName}...`, 'warning');
            
            // Delete the model
            await ollamaAPI.deleteModel(modelName);
            
            // Reload models
            this.loadModels();
            
            // Show success toast
            uiManager.showToast(`Successfully deleted model: ${modelName}`, 'success');
            
        } catch (error) {
            console.error('Error deleting model:', error);
            uiManager.showToast(`Failed to delete model: ${error.message}`, 'error');
        }
    }
    
    /**
     * Switch to chat page with the selected model
     * @param {string} modelName - The name of the model to chat with
     */
    chatWithModel(modelName) {
        // Set the model in the chat page
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.value = modelName;
            // Trigger the change event
            const event = new Event('change');
            modelSelect.dispatchEvent(event);
        }
        
        // Switch to the chat page
        uiManager.showPage('chat');
    }
}

// The models manager will be initialized in main.js
