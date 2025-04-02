/**
 * UI utility functions for the Ollama Web UI
 */
class UIManager {
    constructor() {
        this.activeTheme = 'light';
        this.initTheme();
    }

    /**
     * Initialize the theme based on user preference or system setting
     */
    initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.setTheme(savedTheme);
        } else {
            // Check for system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                this.setTheme('dark');
            }
        }
    }

    /**
     * Set the theme for the UI
     * @param {string} theme - The theme to set ('light', 'dark', or 'system')
     */
    setTheme(theme) {
        if (theme === 'system') {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.setAttribute('data-theme', 'dark');
                this.activeTheme = 'dark';
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                this.activeTheme = 'light';
            }
        } else {
            document.documentElement.setAttribute('data-theme', theme);
            this.activeTheme = theme;
        }
        localStorage.setItem('theme', theme);
    }

    /**
     * Show a page by its ID
     * @param {string} pageId - The ID of the page to show
     */
    showPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Show the selected page
        const page = document.getElementById(`${pageId}-page`);
        if (page) {
            page.classList.add('active');
        }
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }
    }

    /**
     * Show a dialog by its ID
     * @param {string} dialogId - The ID of the dialog to show
     */
    showDialog(dialogId) {
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            dialog.classList.add('active');
        }
    }

    /**
     * Hide a dialog by its ID
     * @param {string} dialogId - The ID of the dialog to hide
     */
    hideDialog(dialogId) {
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            dialog.classList.remove('active');
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - The type of toast ('success', 'warning', 'error')
     * @param {number} duration - How long to show the toast in ms
     */
    showToast(message, type = 'success', duration = 3000) {
        const toastContainer = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        // Force a reflow to trigger the animation
        void toast.offsetWidth;
        
        toast.style.opacity = '1';
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    /**
     * Format a file size in bytes to a human-readable string
     * @param {number} bytes - The size in bytes
     * @returns {string} - Formatted size string
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format a date string to a human-readable format
     * @param {string} dateString - The date string to format
     * @returns {string} - Formatted date string
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    /**
     * Format code blocks in a message
     * @param {string} text - The text to format
     * @returns {string} - Formatted text with code highlighting
     */
    formatMessage(text) {
        if (!text) return '';
        
        // Convert URLs to links
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        
        // Convert markdown-style code blocks
        text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        
        // Convert markdown-style inline code
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Convert line breaks to <br>
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }

    /**
     * Create a typing indicator element
     * @returns {HTMLElement} - The typing indicator element
     */
    createTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message system typing';
        indicator.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        return indicator;
    }

    /**
     * Create a model card element
     * @param {Object} model - The model data
     * @returns {HTMLElement} - The model card element
     */
    createModelCard(model) {
        const card = document.createElement('div');
        card.className = 'model-card';
        card.dataset.model = model.name;
        
        // Format size
        const size = this.formatFileSize(model.size || 0);
        
        // Determine if it's a custom model
        const isCustom = model.details?.parent_model ? true : false;
        
        card.innerHTML = `
            <div class="model-header">
                <div class="model-name">${model.name}</div>
                ${isCustom ? '<div class="model-tag">Custom</div>' : ''}
            </div>
            <div class="model-body">
                <div class="model-info">
                    <div class="model-info-label">Size</div>
                    <div class="model-info-value">${size}</div>
                </div>
                <div class="model-info">
                    <div class="model-info-label">Modified</div>
                    <div class="model-info-value">${this.formatDate(model.modified_at || new Date())}</div>
                </div>
                ${model.details?.parent_model ? `
                <div class="model-info">
                    <div class="model-info-label">Base Model</div>
                    <div class="model-info-value">${model.details.parent_model}</div>
                </div>` : ''}
                <div class="model-actions">
                    <button class="button chat-with-model" data-model="${model.name}">Chat</button>
                    <button class="button delete-model" data-model="${model.name}">Delete</button>
                </div>
            </div>
        `;
        
        return card;
    }

    /**
     * Create a document card element
     * @param {Object} document - The document data
     * @returns {HTMLElement} - The document card element
     */
    createDocumentCard(document) {
        const card = document.createElement('div');
        card.className = 'document-card';
        card.dataset.id = document.id;
        
        // Format file size
        const size = this.formatFileSize(document.filesize || 0);
        
        // Get file extension for type
        const fileType = document.filename.split('.').pop().toUpperCase();
        
        card.innerHTML = `
            <div class="document-header">
                <div class="document-name">${document.filename}</div>
                <div class="document-type">${fileType}</div>
            </div>
            <div class="document-body">
                <div class="document-info">
                    <div class="document-info-label">Size</div>
                    <div class="document-info-value">${size}</div>
                </div>
                <div class="document-info">
                    <div class="document-info-label">Uploaded</div>
                    <div class="document-info-value">${this.formatDate(document.upload_date || new Date())}</div>
                </div>
                <div class="document-info">
                    <div class="document-info-label">Pages</div>
                    <div class="document-info-value">${document.estimated_pages || 'N/A'}</div>
                </div>
                <div class="document-actions">
                    <button class="button view-document" data-id="${document.id}">View</button>
                    <button class="button delete-document" data-id="${document.id}">Delete</button>
                </div>
            </div>
        `;
        
        return card;
    }
}

// Export a singleton instance
const uiManager = new UIManager();
