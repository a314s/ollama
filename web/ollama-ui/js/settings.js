/**
 * Settings management functionality for the Ollama Web UI
 */
class SettingsManager {
    constructor() {
        this.apiHostInput = document.getElementById('api-host');
        this.themeSelect = document.getElementById('theme-select');
        this.codeHighlightingCheckbox = document.getElementById('code-highlighting');
        this.defaultModelSelect = document.getElementById('default-model');
        this.defaultTemperatureInput = document.getElementById('default-temperature');
        this.temperatureValue = document.getElementById('temperature-value');
        this.defaultContextInput = document.getElementById('default-context');
        this.saveSettingsBtn = document.getElementById('save-settings-btn');
        
        this.settings = {
            apiHost: 'http://localhost:11434',
            theme: 'system',
            codeHighlighting: true,
            defaultModel: '',
            defaultTemperature: 0.7,
            defaultContext: 4096
        };
        
        this.init();
    }
    
    /**
     * Initialize the settings management functionality
     */
    init() {
        // Load settings
        this.loadSettings();
        
        // Load models for the default model dropdown
        this.loadModels();
        
        // Set up temperature slider
        this.defaultTemperatureInput.addEventListener('input', () => {
            const value = parseFloat(this.defaultTemperatureInput.value);
            this.temperatureValue.textContent = value.toFixed(1);
        });
        
        // Set up save button
        this.saveSettingsBtn.addEventListener('click', () => {
            this.saveSettings();
        });
        
        // Set up theme selector
        this.themeSelect.addEventListener('change', () => {
            const theme = this.themeSelect.value;
            uiManager.setTheme(theme);
        });
    }
    
    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const savedSettings = localStorage.getItem('settings');
        if (savedSettings) {
            try {
                const parsedSettings = JSON.parse(savedSettings);
                this.settings = { ...this.settings, ...parsedSettings };
            } catch (error) {
                console.error('Error parsing settings:', error);
            }
        }
        
        // Apply settings to form elements
        this.apiHostInput.value = this.settings.apiHost;
        this.themeSelect.value = this.settings.theme;
        this.codeHighlightingCheckbox.checked = this.settings.codeHighlighting;
        this.defaultTemperatureInput.value = this.settings.defaultTemperature;
        this.temperatureValue.textContent = this.settings.defaultTemperature.toFixed(1);
        this.defaultContextInput.value = this.settings.defaultContext;
        
        // Apply settings to the application
        ollamaAPI.setBaseUrl(this.settings.apiHost);
        uiManager.setTheme(this.settings.theme);
    }
    
    /**
     * Load models for the default model dropdown
     */
    async loadModels() {
        try {
            const models = await ollamaAPI.listModels();
            
            // Clear the dropdown
            this.defaultModelSelect.innerHTML = '';
            
            if (models.length === 0) {
                this.defaultModelSelect.innerHTML = '<option value="">No models available</option>';
                return;
            }
            
            // Add models to the dropdown
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                this.defaultModelSelect.appendChild(option);
            });
            
            // Set the default model if it exists
            if (this.settings.defaultModel && models.some(model => model.name === this.settings.defaultModel)) {
                this.defaultModelSelect.value = this.settings.defaultModel;
            } else if (models.length > 0) {
                this.defaultModelSelect.value = models[0].name;
                this.settings.defaultModel = models[0].name;
            }
            
        } catch (error) {
            console.error('Error loading models for settings:', error);
            this.defaultModelSelect.innerHTML = '<option value="">Error loading models</option>';
        }
    }
    
    /**
     * Save settings to localStorage
     */
    saveSettings() {
        // Get values from form elements
        this.settings.apiHost = this.apiHostInput.value.trim();
        this.settings.theme = this.themeSelect.value;
        this.settings.codeHighlighting = this.codeHighlightingCheckbox.checked;
        this.settings.defaultModel = this.defaultModelSelect.value;
        this.settings.defaultTemperature = parseFloat(this.defaultTemperatureInput.value);
        this.settings.defaultContext = parseInt(this.defaultContextInput.value, 10);
        
        // Validate API host
        if (!this.settings.apiHost) {
            uiManager.showToast('API Host cannot be empty', 'error');
            return;
        }
        
        // Save settings to localStorage
        localStorage.setItem('settings', JSON.stringify(this.settings));
        
        // Apply settings to the application
        ollamaAPI.setBaseUrl(this.settings.apiHost);
        uiManager.setTheme(this.settings.theme);
        
        // Update current model if needed
        const modelSelect = document.getElementById('model-select');
        if (modelSelect && this.settings.defaultModel && !modelSelect.value) {
            modelSelect.value = this.settings.defaultModel;
            // Trigger the change event
            const event = new Event('change');
            modelSelect.dispatchEvent(event);
        }
        
        // Show success toast
        uiManager.showToast('Settings saved successfully', 'success');
    }
    
    /**
     * Get a setting value
     * @param {string} key - The setting key
     * @returns {any} - The setting value
     */
    getSetting(key) {
        return this.settings[key];
    }
}

// The settings manager will be initialized in main.js
