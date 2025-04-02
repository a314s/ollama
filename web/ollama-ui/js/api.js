/**
 * API client for interacting with the Ollama API
 */
class OllamaAPI {
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl;
        this.requestTimeout = 30000; // 30 seconds timeout for requests
    }

    /**
     * Set the base URL for the API
     * @param {string} url - The base URL
     */
    setBaseUrl(url) {
        this.baseUrl = url;
    }

    /**
     * Set the request timeout
     * @param {number} timeout - Timeout in milliseconds
     */
    setTimeout(timeout) {
        this.requestTimeout = timeout;
    }

    /**
     * Make an API request with error handling
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<any>} - Response data
     * @private
     */
    async _request(endpoint, options = {}) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
            
            options.signal = controller.signal;
            
            const response = await fetch(`${this.baseUrl}${endpoint}`, options);
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                let errorMessage = `API Error: ${response.status} ${response.statusText}`;
                
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    // Ignore JSON parsing error
                }
                
                throw new Error(errorMessage);
            }
            
            // For endpoints that return JSON
            if (response.headers.get('content-type')?.includes('application/json')) {
                return await response.json();
            }
            
            // For endpoints that return text or other formats
            return await response.text();
            
        } catch (error) {
            // Handle timeout errors
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. The server took too long to respond.');
            }
            
            // Handle network errors
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error. Make sure the Ollama server is running and accessible.');
            }
            
            // Re-throw other errors
            throw error;
        }
    }

    /**
     * List all available models
     * @returns {Promise<Array>} - List of models
     */
    async listModels() {
        try {
            const data = await this._request('/api/tags');
            return data.models || [];
        } catch (error) {
            console.error('Error listing models:', error);
            throw error;
        }
    }

    /**
     * Pull a model from the Ollama library
     * @param {string} modelName - The name of the model to pull
     * @param {Function} progressCallback - Callback for progress updates
     * @returns {Promise<Object>} - Pull result
     */
    async pullModel(modelName, progressCallback = null) {
        try {
            // Validate model name
            if (!modelName || typeof modelName !== 'string') {
                throw new Error('Invalid model name');
            }
            
            // Start pull request
            const response = await fetch(`${this.baseUrl}/api/pull`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: modelName })
            });
            
            // Set up reader for streaming response
            const reader = response.body.getReader();
            let result = '';
            
            // Process stream
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }
                
                // Convert the chunk to text
                const chunk = new TextDecoder().decode(value);
                result += chunk;
                
                // Parse progress from chunk
                try {
                    // Each line is a separate JSON object
                    const lines = chunk.split('\n').filter(line => line.trim());
                    
                    for (const line of lines) {
                        const data = JSON.parse(line);
                        
                        if (data.status) {
                            console.log('Pull status:', data.status);
                        }
                        
                        if (data.completed && progressCallback) {
                            progressCallback({
                                percent: Math.round((data.completed / data.total) * 100),
                                completed: data.completed,
                                total: data.total
                            });
                        }
                    }
                } catch (e) {
                    console.error('Error parsing progress:', e);
                }
            }
            
            return { success: true, model: modelName };
            
        } catch (error) {
            console.error('Error pulling model:', error);
            throw error;
        }
    }

    /**
     * Create a custom model from a Modelfile
     * @param {string} modelName - The name for the new model
     * @param {string} modelfile - The Modelfile content
     * @param {Function} progressCallback - Callback for progress updates
     * @returns {Promise<Object>} - Creation result
     */
    async createModel(modelName, modelfile, progressCallback = null) {
        try {
            // Validate inputs
            if (!modelName || typeof modelName !== 'string') {
                throw new Error('Invalid model name');
            }
            
            if (!modelfile || typeof modelfile !== 'string') {
                throw new Error('Invalid Modelfile content');
            }
            
            // Start create request
            const response = await fetch(`${this.baseUrl}/api/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: modelName,
                    modelfile: modelfile
                })
            });
            
            // Set up reader for streaming response
            const reader = response.body.getReader();
            let result = '';
            
            // Process stream
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }
                
                // Convert the chunk to text
                const chunk = new TextDecoder().decode(value);
                result += chunk;
                
                // Parse progress from chunk
                try {
                    // Each line is a separate JSON object
                    const lines = chunk.split('\n').filter(line => line.trim());
                    
                    for (const line of lines) {
                        const data = JSON.parse(line);
                        
                        if (data.status) {
                            console.log('Create status:', data.status);
                            
                            if (progressCallback) {
                                progressCallback({
                                    status: data.status
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error parsing progress:', e);
                }
            }
            
            return { success: true, model: modelName };
            
        } catch (error) {
            console.error('Error creating model:', error);
            throw error;
        }
    }

    /**
     * Delete a model
     * @param {string} modelName - The name of the model to delete
     * @returns {Promise<Object>} - Deletion result
     */
    async deleteModel(modelName) {
        try {
            // Validate model name
            if (!modelName || typeof modelName !== 'string') {
                throw new Error('Invalid model name');
            }
            
            await this._request('/api/delete', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: modelName })
            });
            
            return { success: true, model: modelName };
            
        } catch (error) {
            console.error('Error deleting model:', error);
            throw error;
        }
    }

    /**
     * Generate a completion from a model
     * @param {string} modelName - The name of the model to use
     * @param {string} prompt - The prompt to generate from
     * @param {Object} options - Generation options
     * @param {Function} streamCallback - Callback for streaming responses
     * @returns {Promise<Object>} - Generation result
     */
    async generateCompletion(modelName, prompt, options = {}, streamCallback = null) {
        try {
            // Validate inputs
            if (!modelName || typeof modelName !== 'string') {
                throw new Error('Invalid model name');
            }
            
            if (!prompt || typeof prompt !== 'string') {
                throw new Error('Invalid prompt');
            }
            
            // Prepare request body
            const requestBody = {
                model: modelName,
                prompt: prompt,
                stream: !!streamCallback,
                options: options
            };
            
            // If streaming, handle with streaming API
            if (streamCallback) {
                const response = await fetch(`${this.baseUrl}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                if (!response.ok) {
                    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
                    
                    try {
                        const errorData = await response.json();
                        if (errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (e) {
                        // Ignore JSON parsing error
                    }
                    
                    throw new Error(errorMessage);
                }
                
                // Set up reader for streaming response
                const reader = response.body.getReader();
                let fullResponse = '';
                
                // Process stream
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        break;
                    }
                    
                    // Convert the chunk to text
                    const chunk = new TextDecoder().decode(value);
                    
                    // Parse response from chunk
                    try {
                        // Each line is a separate JSON object
                        const lines = chunk.split('\n').filter(line => line.trim());
                        
                        for (const line of lines) {
                            const data = JSON.parse(line);
                            
                            if (data.response) {
                                fullResponse += data.response;
                                streamCallback(data.response, false, data);
                            }
                            
                            if (data.done) {
                                streamCallback('', true, data);
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing stream:', e);
                    }
                }
                
                return { success: true, response: fullResponse };
                
            } else {
                // Non-streaming request
                const data = await this._request('/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                return { success: true, response: data.response };
            }
            
        } catch (error) {
            console.error('Error generating completion:', error);
            throw error;
        }
    }

    /**
     * Send a message in a chat conversation
     * @param {string} modelName - The name of the model to use
     * @param {Array} messages - The chat messages
     * @param {Object} options - Generation options
     * @param {Function} streamCallback - Callback for streaming responses
     * @returns {Promise<Object>} - Chat result
     */
    async chat(modelName, messages, options = {}, streamCallback = null) {
        try {
            // Validate inputs
            if (!modelName || typeof modelName !== 'string') {
                throw new Error('Invalid model name');
            }
            
            if (!Array.isArray(messages) || messages.length === 0) {
                throw new Error('Invalid messages array');
            }
            
            // Prepare request body
            const requestBody = {
                model: modelName,
                messages: messages,
                stream: !!streamCallback,
                options: options
            };
            
            // If streaming, handle with streaming API
            if (streamCallback) {
                const response = await fetch(`${this.baseUrl}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                if (!response.ok) {
                    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
                    
                    try {
                        const errorData = await response.json();
                        if (errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (e) {
                        // Ignore JSON parsing error
                    }
                    
                    throw new Error(errorMessage);
                }
                
                // Set up reader for streaming response
                const reader = response.body.getReader();
                let fullResponse = '';
                
                // Process stream
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        break;
                    }
                    
                    // Convert the chunk to text
                    const chunk = new TextDecoder().decode(value);
                    
                    // Parse response from chunk
                    try {
                        // Each line is a separate JSON object
                        const lines = chunk.split('\n').filter(line => line.trim());
                        
                        for (const line of lines) {
                            const data = JSON.parse(line);
                            
                            if (data.message && data.message.content) {
                                const content = data.message.content;
                                fullResponse += content;
                                streamCallback(content, false, data);
                            }
                            
                            if (data.done) {
                                streamCallback('', true, data);
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing stream:', e);
                    }
                }
                
                return { 
                    success: true, 
                    message: { 
                        role: 'assistant', 
                        content: fullResponse 
                    } 
                };
                
            } else {
                // Non-streaming request
                const data = await this._request('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                return { success: true, message: data.message };
            }
            
        } catch (error) {
            console.error('Error in chat:', error);
            throw error;
        }
    }

    /**
     * Upload a document for processing
     * @param {File} file - The file to upload
     * @param {Function} progressCallback - Callback for progress updates
     * @returns {Promise<Object>} - Upload result
     */
    async uploadDocument(file, progressCallback = null) {
        try {
            // Validate file
            if (!file || !(file instanceof File)) {
                throw new Error('Invalid file object');
            }
            
            // Check file size
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (file.size > maxSize) {
                throw new Error(`File size exceeds the maximum limit of ${maxSize / (1024 * 1024)}MB`);
            }
            
            // Check file type
            const validTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
                'text/markdown',
                'text/csv'
            ];
            
            if (!validTypes.includes(file.type)) {
                throw new Error('Unsupported file type');
            }
            
            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            
            // Upload with progress tracking
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                
                xhr.open('POST', `${this.baseUrl}/api/documents`, true);
                
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable && progressCallback) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        progressCallback({
                            percent,
                            loaded: event.loaded,
                            total: event.total
                        });
                    }
                };
                
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response);
                        } catch (e) {
                            resolve({ success: true, documentId: 'unknown' });
                        }
                    } else {
                        let errorMessage = `Upload failed: ${xhr.status} ${xhr.statusText}`;
                        
                        try {
                            const errorData = JSON.parse(xhr.responseText);
                            if (errorData.error) {
                                errorMessage = errorData.error;
                            }
                        } catch (e) {
                            // Ignore JSON parsing error
                        }
                        
                        reject(new Error(errorMessage));
                    }
                };
                
                xhr.onerror = () => {
                    reject(new Error('Network error during upload'));
                };
                
                xhr.ontimeout = () => {
                    reject(new Error('Upload timed out'));
                };
                
                xhr.send(formData);
            });
            
        } catch (error) {
            console.error('Error uploading document:', error);
            throw error;
        }
    }

    /**
     * List all available documents
     * @returns {Promise<Array>} - List of documents
     */
    async listDocuments() {
        try {
            const data = await this._request('/api/documents');
            return data.documents || [];
        } catch (error) {
            console.error('Error listing documents:', error);
            throw error;
        }
    }

    /**
     * Get document details
     * @param {string} documentId - The ID of the document
     * @returns {Promise<Object>} - Document details
     */
    async getDocument(documentId) {
        try {
            // Validate document ID
            if (!documentId || typeof documentId !== 'string') {
                throw new Error('Invalid document ID');
            }
            
            const data = await this._request(`/api/documents/${documentId}`);
            return data.document || {};
        } catch (error) {
            console.error('Error getting document:', error);
            throw error;
        }
    }

    /**
     * Delete a document
     * @param {string} documentId - The ID of the document to delete
     * @returns {Promise<Object>} - Deletion result
     */
    async deleteDocument(documentId) {
        try {
            // Validate document ID
            if (!documentId || typeof documentId !== 'string') {
                throw new Error('Invalid document ID');
            }
            
            await this._request(`/api/documents/${documentId}`, {
                method: 'DELETE'
            });
            
            return { success: true, documentId };
        } catch (error) {
            console.error('Error deleting document:', error);
            throw error;
        }
    }

    /**
     * Get document sections
     * @param {string} documentId - The ID of the document
     * @returns {Promise<Array>} - List of document sections
     */
    async getDocumentSections(documentId) {
        try {
            // Validate document ID
            if (!documentId || typeof documentId !== 'string') {
                throw new Error('Invalid document ID');
            }
            
            const data = await this._request(`/api/documents/${documentId}/sections`);
            return data.sections || [];
        } catch (error) {
            console.error('Error getting document sections:', error);
            throw error;
        }
    }

    /**
     * Get document table of contents
     * @param {string} documentId - The ID of the document
     * @returns {Promise<Array>} - Table of contents
     */
    async getDocumentTOC(documentId) {
        try {
            // Validate document ID
            if (!documentId || typeof documentId !== 'string') {
                throw new Error('Invalid document ID');
            }
            
            const data = await this._request(`/api/documents/${documentId}/toc`);
            return data.toc || [];
        } catch (error) {
            console.error('Error getting document TOC:', error);
            throw error;
        }
    }

    /**
     * Get specific document section
     * @param {string} documentId - The ID of the document
     * @param {string} sectionIndex - The index of the section
     * @returns {Promise<Object>} - Section content
     */
    async getDocumentSection(documentId, sectionIndex) {
        try {
            // Validate inputs
            if (!documentId || typeof documentId !== 'string') {
                throw new Error('Invalid document ID');
            }
            
            if (!sectionIndex || (typeof sectionIndex !== 'string' && typeof sectionIndex !== 'number')) {
                throw new Error('Invalid section index');
            }
            
            const data = await this._request(`/api/documents/${documentId}/sections/${sectionIndex}`);
            return data.section || {};
        } catch (error) {
            console.error('Error getting document section:', error);
            throw error;
        }
    }

    /**
     * Get document entities
     * @param {string} documentId - The ID of the document
     * @returns {Promise<Array>} - List of entities
     */
    async getDocumentEntities(documentId) {
        try {
            // Validate document ID
            if (!documentId || typeof documentId !== 'string') {
                throw new Error('Invalid document ID');
            }
            
            const data = await this._request(`/api/documents/${documentId}/entities`);
            return data.entities || [];
        } catch (error) {
            console.error('Error getting document entities:', error);
            throw error;
        }
    }

    /**
     * Open the original document
     * @param {string} documentId - The ID of the document
     * @returns {Promise<Object>} - Result
     */
    async openDocument(documentId) {
        try {
            // Validate document ID
            if (!documentId || typeof documentId !== 'string') {
                throw new Error('Invalid document ID');
            }
            
            await this._request(`/api/documents/${documentId}/open`, {
                method: 'POST'
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error opening document:', error);
            throw error;
        }
    }

    /**
     * Query documents with a question
     * @param {string} query - The query text
     * @param {Array} documentIds - Optional list of document IDs to query (if empty, query all)
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Query result
     */
    async queryDocuments(query, documentIds = [], options = {}) {
        try {
            // Validate query
            if (!query || typeof query !== 'string') {
                throw new Error('Invalid query');
            }
            
            // Prepare request body
            const requestBody = {
                query,
                options
            };
            
            if (Array.isArray(documentIds) && documentIds.length > 0) {
                requestBody.documentIds = documentIds;
            }
            
            const data = await this._request('/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            return data;
        } catch (error) {
            console.error('Error querying documents:', error);
            throw error;
        }
    }
}

// Export a singleton instance
const ollamaAPI = new OllamaAPI();
