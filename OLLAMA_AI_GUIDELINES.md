# Ollama Web UI Development Guidelines

## API Guidelines

### Base Configuration
- Default API endpoint: `http://localhost:11434`
- Request timeout: 30 seconds
- Content type: `application/json`

### API Endpoints
1. Models
   - List models: `GET /api/tags`
   - Pull model: `POST /api/pull`
   - Create model: `POST /api/create`
   - Delete model: `DELETE /api/delete`

2. Chat/Generation
   - Generate completion: `POST /api/generate`
   - Chat: `POST /api/chat`

3. Documents
   - Upload: `POST /api/documents`
   - List: `GET /api/documents`
   - Get details: `GET /api/documents/{id}`
   - Delete: `DELETE /api/documents/{id}`
   - Get sections: `GET /api/documents/{id}/sections`
   - Get TOC: `GET /api/documents/{id}/toc`
   - Get entities: `GET /api/documents/{id}/entities`

### Error Handling
- All API calls should include proper error handling
- Error responses include:
  - Network errors (Failed to fetch)
  - Timeout errors (Request timed out)
  - API-specific errors (returned in response)
- Error messages should be user-friendly and actionable

### File Upload Restrictions
- Maximum file size: 50MB
- Supported file types:
  - PDF (`application/pdf`)
  - Word (`application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
  - Text (`text/plain`)
  - Markdown (`text/markdown`)
  - CSV (`text/csv`)

## Styling Guidelines

### Color Scheme
Light Theme:
```css
--bg-primary: #ffffff
--bg-secondary: #f5f7fa
--bg-tertiary: #edf0f5
--text-primary: #1a1a1a
--text-secondary: #4a5568
--text-tertiary: #718096
--border-color: #e2e8f0
--accent-color: #2563EB
--accent-hover: #1D4ED8
--success-color: #10b981
--warning-color: #f59e0b
--error-color: #ef4444
--message-user-bg: #EBF2FF
--message-system-bg: #ffffff
--code-bg: #f1f5f9
```

Dark Theme:
```css
--bg-primary: #1a1a1a
--bg-secondary: #2d3748
--bg-tertiary: #374151
--text-primary: #f7fafc
--text-secondary: #cbd5e0
--text-tertiary: #a0aec0
--border-color: #4a5568
--accent-color: #3B82F6
--accent-hover: #60A5FA
--message-user-bg: #1E40AF
--message-system-bg: #2d3748
--code-bg: #1e293b
```

### Typography
- Font family: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- Code font: `"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace`
- Base line height: 1.5

### Layout
- Sidebar width: 280px
- Chat input max height: 150px
- Toast notifications:
  - Min width: 250px
  - Max width: 350px
- Dialog max width: 600px
- Model/Document cards: Minimum width 300px

### Components

#### Buttons
```css
.button {
    padding: 0.5rem 1rem
    border-radius: 0.375rem
    font-size: 0.875rem
    font-weight: 500
}

.button.mini {
    padding: 0.25rem 0.5rem
    font-size: 0.75rem
}
```

#### Messages
- User messages: Right-aligned, accent color background
- System messages: Left-aligned, neutral background
- Error messages: Red background with white text
- Maximum width: 80% of container

#### Progress Indicators
- Height: 8px
- Border radius: 4px
- Animated transitions: 0.3s ease

## Connection Management

### Connection States
1. Connected
   - Indicator: Green
   - Auto-refresh: Every 30 seconds
   - Validates: API availability, model list, chat functionality

2. Disconnected
   - Indicator: Red
   - Shows reconnect button
   - Provides troubleshooting steps

3. Checking
   - Indicator: Yellow
   - Animated pulse
   - Timeout: 10 seconds

### Validation Checks
1. Basic Connection
   - Endpoint accessibility
   - Response status
   - Timeout handling

2. Deep Validation
   - Models API functionality
   - Chat API functionality
   - Document API functionality (optional)

### Error Recovery
- Automatic reconnection attempts
- User-initiated reconnection
- Detailed error logging
- Troubleshooting suggestions based on error type

## Chat Implementation

### Message Handling
- Support for streaming responses
- Message history persistence in localStorage
- Automatic scroll to new messages
- Typing indicators for responses
- Code block formatting
- Markdown support

### Model Selection
- Persistent model selection
- Custom model support
- Model validation before chat
- Automatic model availability checking

### Input Handling
- Auto-expanding textarea
- Enter to send (Shift+Enter for new line)
- Input validation
- Disabled state during processing

## Configuration Parameters

### Application Settings
- Version: 0.1.0
- Default API Host: `http://localhost:11434`

### Document Processing
- Maximum file size: 50MB
- Supported file types:
  ```javascript
  [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv'
  ]
  ```
- Features:
  - Section extraction
  - Entity extraction
  - Table of contents generation
  - Content summarization

### Model Parameters
Default values:
```javascript
{
    temperature: 0.7,    // Controls randomness in generation
    top_p: 0.9,         // Nucleus sampling parameter
    top_k: 40,          // Top-k sampling parameter
    context_window: 4096 // Maximum context length
}
```

## Best Practices

1. Error Handling
   - Always provide user feedback
   - Include troubleshooting steps
   - Log errors for debugging
   - Graceful fallbacks

2. Performance
   - Debounce connection checks
   - Optimize message rendering
   - Clean up event listeners
   - Manage memory usage

3. User Experience
   - Responsive design (mobile-first)
   - Loading states for all actions
   - Clear error messages
   - Persistent settings

4. Security
   - Validate file uploads
   - Sanitize user input
   - Secure API communication
   - Error message sanitization

## Known Issues and Troubleshooting

### Model Validation Issues
1. Invalid Model Name Error
   - **Cause**: Model name validation is failing due to incorrect format or missing model
   - **Solution**:
     ```javascript
     // Correct model name format
     modelName = "llama2:latest" // With tag
     modelName = "llama2"        // Without tag
     ```
   - **Validation Rules**:
     - Must match pattern: `^[a-zA-Z0-9._-]+:[a-zA-Z0-9._-]+$` (with tag)
     - Or pattern: `^[a-zA-Z0-9._-]+$` (without tag)
   - **Implementation**:
     1. Always validate model name before API calls
     2. Ensure model exists on server before attempting chat
     3. Handle model not found errors gracefully

### Document Processing Issues
1. PDF Upload Failures
   - **Cause**: Document processing validation or API endpoint issues
   - **Solution**:
     ```javascript
     // Required document validation steps
     1. Check file type (application/pdf)
     2. Verify file size (< 50MB)
     3. Validate API endpoint availability
     4. Ensure proper content-type headers
     ```
   - **Implementation**:
     1. Use proper file type validation
     2. Implement robust error handling
     3. Add retry mechanism for failed uploads
     4. Provide clear error messages to users

### Connection Management
1. Server Connection Issues
   - **Steps**:
     1. Verify server is running (`http://localhost:11434`)
     2. Check connection status
     3. Validate API endpoints
     4. Monitor connection logs

2. Error Recovery
   - Implement automatic reconnection
   - Provide manual reconnect option
   - Log connection events
   - Show user-friendly error messages

### Best Practices for Issue Prevention
1. Model Management
   - Cache available models list
   - Validate models before chat
   - Handle model loading failures
   - Provide model status indicators

2. Document Handling
   - Implement progressive uploads
   - Add upload resume capability
   - Validate before processing
   - Monitor upload progress

3. Error Handling
   - Log all errors with context
   - Provide clear user feedback
   - Implement fallback options
   - Monitor error patterns
