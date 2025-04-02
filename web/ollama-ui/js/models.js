/**
 * Model management functionality for the NaviTechAid Web UI
 */
class ModelsManager {
    constructor() {
        this.modelsList = document.getElementById('models-list');
        this.modelTags = document.getElementById('model-tags');
        this.pullModelBtn = document.getElementById('pull-model-btn');
        this.pullModelDialog = document.getElementById('pull-model-dialog');
        this.pullModelForm = document.getElementById('pull-model-form');
        this.pullModelName = document.getElementById('pull-model-name');
        this.pullModelSubmit = document.getElementById('pull-model-submit');
        this.pullModelCancel = document.getElementById('pull-model-cancel');
        this.pullModelProgress = document.getElementById('pull-model-progress');
        this.pullModelStatus = document.getElementById('pull-model-status');
        
        this.models = [];
        this.isPulling = false;
        
        this.init();
    }
    
    /**
     * Initialize the model management functionality
     */
    init() {
        // Load models
        this.loadModels();
        
        // Set up pull model dialog
        this.pullModelBtn.addEventListener('click', () => {
            this.showPullModelDialog();
        });
        
        // Handle form submission
        this.pullModelForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.pullModel(this.pullModelName.value);
        });
        
        // Handle dialog close
        this.pullModelCancel.addEventListener('click', () => {
            this.hidePullModelDialog();
        });
        
        // Set up event delegation for model actions
        this.modelsList.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.classList.contains('delete-model-btn')) {
                const modelId = target.closest('.model-card').dataset.modelId;
                this.confirmDeleteModel(modelId);
            }
        });
    }
    
    /**
     * Show the pull model dialog
     */
    showPullModelDialog() {
        this.pullModelDialog.classList.add('active');
        setTimeout(() => {
            this.pullModelName.focus();
        }, 100);
    }
    
    /**
     * Hide the pull model dialog
     */
    hidePullModelDialog() {
        this.pullModelDialog.classList.remove('active');
        this.pullModelName.value = '';
        this.pullModelProgress.style.display = 'none';
        this.pullModelStatus.textContent = '';
    }
    
    /**
     * Load models from the NaviTechAid server
     */
    async loadModels() {
        try {
            // Check connection first
            if (!window.connectionManager || !window.connectionManager.isConnected) {
                this.displayModelsLoadingError("Not connected to NaviTechAid server");
                return;
            }
            
            // Clear the models list
            this.modelsList.innerHTML = '<div class="loading">Loading models...</div>';
            
            // Fetch models
            const models = await naviTechAidAPI.listModels();
            this.models = models;
            
            // Display models
            this.displayModels();
            
        } catch (error) {
            console.error('Error loading models:', error);
            this.displayModelsLoadingError(error.message);
            
            // Log error to connection manager
            if (window.connectionManager) {
                window.connectionManager.logConnectionEvent(`Models loading error: ${error.message}`, 'error');
            }
        }
    }
    
    /**
     * Display models
     */
    displayModels() {
        if (!this.models || this.models.length === 0) {
            this.modelsList.innerHTML = '<div class="empty-state">No models available. Pull a model to get started.</div>';
            return;
        }
        
        // Clear the list
        this.modelsList.innerHTML = '';
        
        // Group models by format
        const modelsByFormat = {};
        
        this.models.forEach(model => {
            const format = model.details?.format || 'Unknown';
            
            if (!modelsByFormat[format]) {
                modelsByFormat[format] = [];
            }
            
            modelsByFormat[format].push(model);
        });
        
        // Create format sections
        for (const format in modelsByFormat) {
            const formatSection = document.createElement('div');
            formatSection.className = 'format-section';
            
            const formatHeader = document.createElement('h3');
            formatHeader.className = 'format-header';
            formatHeader.textContent = format;
            
            const formatModels = document.createElement('div');
            formatModels.className = 'format-models';
            
            modelsByFormat[format].forEach(model => {
                const modelCard = this.createModelCard(model);
                formatModels.appendChild(modelCard);
            });
            
            formatSection.appendChild(formatHeader);
            formatSection.appendChild(formatModels);
            
            this.modelsList.appendChild(formatSection);
        }
        
        // Update model tags
        this.updateModelTags();
    }
    
    /**
     * Display models loading error
     * @param {string} message - The error message
     */
    displayModelsLoadingError(message) {
        this.modelsList.innerHTML = `
            <div class="error-state">
                <p>Failed to load models: ${message}</p>
                <p>Check that the NaviTechAid server is running and properly configured.</p>
            </div>
        `;
    }
    
    /**
     * Create a model card element
     * @param {Object} model - The model data
     * @returns {HTMLElement} - The model card element
     */
    createModelCard(model) {
        const modelCard = document.createElement('div');
        modelCard.className = 'model-card';
        modelCard.dataset.modelId = model.name;
        
        // Get model info
        const modelName = model.name;
        const modelFamily = this.getModelFamily(model);
        const modelParams = this.getModelParams(model);
        const modelSize = this.getModelSize(model);
        const modelDetails = model.details || {};
        
        // Create card content
        modelCard.innerHTML = `
            <div class="model-info">
                <h4 class="model-name">${modelName}</h4>
                <div class="model-meta">
                    ${modelFamily ? `<span class="model-family">${modelFamily}</span>` : ''}
                    ${modelParams ? `<span class="model-params">${modelParams}</span>` : ''}
                    ${modelSize ? `<span class="model-size">${modelSize}</span>` : ''}
                </div>
                ${modelDetails.description ? `<p class="model-description">${modelDetails.description}</p>` : ''}
            </div>
            <div class="model-actions">
                <button class="chat-with-model-btn" data-model="${modelName}">Chat</button>
                <button class="delete-model-btn" data-model="${modelName}">Delete</button>
            </div>
        `;
        
        // Add chat with model handler
        modelCard.querySelector('.chat-with-model-btn').addEventListener('click', () => {
            this.chatWithModel(modelName);
        });
        
        return modelCard;
    }
    
    /**
     * Extract model family from model data
     * @param {Object} model - The model data
     * @returns {string} - The model family
     */
    getModelFamily(model) {
        const name = model.name.toLowerCase();
        
        if (name.includes('llama')) return 'LLaMA';
        if (name.includes('mistral')) return 'Mistral';
        if (name.includes('phi')) return 'Phi';
        if (name.includes('stable') || name.includes('diffusion')) return 'Stable Diffusion';
        if (name.includes('clip')) return 'CLIP';
        
        return '';
    }
    
    /**
     * Extract model parameters from model data
     * @param {Object} model - The model data
     * @returns {string} - The model parameters
     */
    getModelParams(model) {
        const name = model.name.toLowerCase();
        const details = model.details || {};
        
        // Try to extract from model details
        if (details.parameter_size) {
            const size = parseFloat(details.parameter_size);
            if (!isNaN(size)) {
                if (size >= 1) {
                    return `${size}B params`;
                } else {
                    return `${size * 1000}M params`;
                }
            }
        }
        
        // Try to extract from model name
        const paramMatch = name.match(/[-_](\d+)b/);
        if (paramMatch) {
            return `${paramMatch[1]}B params`;
        }
        
        return '';
    }
    
    /**
     * Get model size
     * @param {Object} model - The model data
     * @returns {string} - Formatted size
     */
    getModelSize(model) {
        const details = model.details || {};
        
        if (details.size) {
            return uiManager.formatFileSize(details.size);
        }
        
        return '';
    }
    
    /**
     * Update model tags for filtering
     */
    updateModelTags() {
        if (!this.modelTags) return;
        
        // Clear tags
        this.modelTags.innerHTML = '<span class="model-tag active" data-tag="all">All</span>';
        
        // Extract unique families
        const families = new Set();
        
        this.models.forEach(model => {
            const family = this.getModelFamily(model);
            if (family) {
                families.add(family);
            }
        });
        
        // Add family tags
        families.forEach(family => {
            const tag = document.createElement('span');
            tag.className = 'model-tag';
            tag.dataset.tag = family.toLowerCase();
            tag.textContent = family;
            this.modelTags.appendChild(tag);
        });
        
        // Add tag click handlers
        const tags = this.modelTags.querySelectorAll('.model-tag');
        tags.forEach(tag => {
            tag.addEventListener('click', () => {
                // Update active tag
                tags.forEach(t => t.classList.remove('active'));
                tag.classList.add('active');
                
                // Filter models
                const tagValue = tag.dataset.tag;
                this.filterModelsByTag(tagValue);
            });
        });
    }
    
    /**
     * Filter models by tag
     * @param {string} tag - The tag to filter by
     */
    filterModelsByTag(tag) {
        const formatSections = this.modelsList.querySelectorAll('.format-section');
        
        if (tag === 'all') {
            // Show all models
            formatSections.forEach(section => {
                section.style.display = 'block';
                
                const modelCards = section.querySelectorAll('.model-card');
                modelCards.forEach(card => {
                    card.style.display = 'flex';
                });
            });
            return;
        }
        
        // Filter by tag
        formatSections.forEach(section => {
            const modelCards = section.querySelectorAll('.model-card');
            let visibleCount = 0;
            
            modelCards.forEach(card => {
                const modelFamily = card.querySelector('.model-family');
                const familyText = modelFamily ? modelFamily.textContent.toLowerCase() : '';
                
                if (familyText === tag) {
                    card.style.display = 'flex';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });
            
            // Show/hide section based on visible models
            section.style.display = visibleCount > 0 ? 'block' : 'none';
        });
    }
    
    /**
     * Pull a model from the NaviTechAid server
     * @param {string} modelName - The name of the model to pull
     */
    async pullModel(modelName) {
        if (!modelName) {
            uiManager.showToast('Please enter a model name', 'warning');
            return;
        }
        
        if (this.isPulling) {
            uiManager.showToast('Already pulling a model', 'warning');
            return;
        }
        
        this.isPulling = true;
        this.pullModelStatus.textContent = `Pulling model: ${modelName}`;
        this.pullModelProgress.style.display = 'block';
        
        try {
            // Check connection first
            if (!window.connectionManager || !window.connectionManager.isConnected) {
                const connected = await window.connectionManager.checkConnection();
                if (!connected) {
                    throw new Error('Not connected to NaviTechAid server. Please check your connection.');
                }
            }
            
            // Prepare the pull request
            const response = await fetch(`${naviTechAidAPI.baseUrl}/api/pull`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: modelName
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to pull model: ${response.status} ${response.statusText}`);
            }
            
            // Handle streaming response
            const reader = response.body.getReader();
            let receivedLength = 0;
            let chunks = [];
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }
                
                chunks.push(value);
                receivedLength += value.length;
                
                // Try to parse the chunk
                try {
                    const decoder = new TextDecoder();
                    const text = decoder.decode(value);
                    
                    // Update status based on response
                    if (text.includes('"status":"pulling"')) {
                        this.pullModelStatus.textContent = `Pulling model: ${modelName}`;
                    } else if (text.includes('"status":"downloading"')) {
                        const match = text.match(/"completed":(\d+),"total":(\d+)/);
                        if (match) {
                            const completed = parseInt(match[1]);
                            const total = parseInt(match[2]);
                            const percent = Math.round((completed / total) * 100);
                            
                            this.pullModelStatus.textContent = `Downloading ${modelName}: ${percent}%`;
                        } else {
                            this.pullModelStatus.textContent = `Downloading ${modelName}`;
                        }
                    } else if (text.includes('"status":"verifying"')) {
                        this.pullModelStatus.textContent = `Verifying ${modelName}`;
                    } else if (text.includes('"status":"done"')) {
                        this.pullModelStatus.textContent = `Model ${modelName} pulled successfully`;
                    }
                } catch (error) {
                    console.log('Error parsing chunk:', error);
                }
            }
            
            uiManager.showToast(`Successfully pulled model ${modelName}`, 'success');
            
            // Log to connection manager
            if (window.connectionManager) {
                window.connectionManager.logConnectionEvent(`Model pulled: ${modelName}`, 'success');
            }
            
            // Reload models
            await this.loadModels();
            
            // Close the dialog
            setTimeout(() => {
                this.hidePullModelDialog();
            }, 1000);
            
        } catch (error) {
            console.error('Error pulling model:', error);
            this.pullModelStatus.textContent = `Error: ${error.message}`;
            uiManager.showToast('Failed to pull model: ' + error.message, 'error');
            
            // Log error to connection manager
            if (window.connectionManager) {
                window.connectionManager.logConnectionEvent(`Model pull error: ${error.message}`, 'error');
            }
        } finally {
            this.isPulling = false;
        }
    }
    
    /**
     * Start a chat with a specific model
     * @param {string} modelName - The model name
     */
    chatWithModel(modelName) {
        // Set the model as active
        localStorage.setItem('activeModel', modelName);
        
        // Navigate to chat page
        document.querySelector('.nav-item[data-page="chat"]').click();
        
        // Inform the user
        uiManager.showToast(`Switched to model: ${modelName}`, 'success');
        
        // Update chat UI if chat manager is available
        if (window.chatManager) {
            window.chatManager.updateActiveChatModel();
        }
    }
    
    /**
     * Confirm model deletion
     * @param {string} modelName - The model to delete
     */
    confirmDeleteModel(modelName) {
        // Create a confirmation dialog
        const dialog = document.createElement('div');
        dialog.className = 'dialog active';
        
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>Delete Model</h3>
                    <button class="close-dialog">&times;</button>
                </div>
                <div class="dialog-body">
                    <p>Are you sure you want to delete the model "${modelName}"?</p>
                    <p>This action cannot be undone.</p>
                </div>
                <div class="dialog-footer">
                    <button class="cancel-dialog">Cancel</button>
                    <button class="confirm-dialog danger">Delete</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Handle dialog close
        dialog.querySelector('.close-dialog').addEventListener('click', () => {
            dialog.remove();
        });
        
        dialog.querySelector('.cancel-dialog').addEventListener('click', () => {
            dialog.remove();
        });
        
        // Handle confirmation
        dialog.querySelector('.confirm-dialog').addEventListener('click', () => {
            dialog.remove();
            this.deleteModel(modelName);
        });
    }
    
    /**
     * Delete a model
     * @param {string} modelName - The model to delete
     */
    async deleteModel(modelName) {
        try {
            // Check connection first
            if (!window.connectionManager || !window.connectionManager.isConnected) {
                const connected = await window.connectionManager.checkConnection();
                if (!connected) {
                    throw new Error('Not connected to NaviTechAid server. Please check your connection.');
                }
            }
            
            // Delete the model
            const response = await fetch(`${naviTechAidAPI.baseUrl}/api/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: modelName
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to delete model: ${response.status} ${response.statusText}`);
            }
            
            uiManager.showToast(`Model ${modelName} deleted successfully`, 'success');
            
            // Log to connection manager
            if (window.connectionManager) {
                window.connectionManager.logConnectionEvent(`Model deleted: ${modelName}`, 'info');
            }
            
            // If the deleted model was the active model, clear it
            const activeModel = localStorage.getItem('activeModel');
            if (activeModel === modelName) {
                localStorage.removeItem('activeModel');
                
                // Update chat UI if chat manager is available
                if (window.chatManager) {
                    window.chatManager.updateActiveChatModel();
                }
            }
            
            // Reload models
            await this.loadModels();
            
        } catch (error) {
            console.error('Error deleting model:', error);
            uiManager.showToast('Failed to delete model: ' + error.message, 'error');
            
            // Log error to connection manager
            if (window.connectionManager) {
                window.connectionManager.logConnectionEvent(`Model deletion error: ${error.message}`, 'error');
            }
        }
    }
}
