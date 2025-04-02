/**
 * Configuration for the Ollama Web UI
 */
const CONFIG = {
    // Application version
    version: '0.1.0',
    
    // Default API host
    defaultApiHost: 'http://localhost:11434',
    
    // Document processing capabilities
    documentProcessing: {
        // Supported file types
        supportedTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/markdown',
            'text/csv'
        ],
        
        // Maximum file size (in bytes)
        maxFileSize: 50 * 1024 * 1024, // 50MB
        
        // Document analysis features
        features: {
            sectionExtraction: true,
            entityExtraction: true,
            tocGeneration: true,
            contentSummary: true
        }
    },
    
    // Default model parameters
    defaultModelParams: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        context_window: 4096
    }
};
