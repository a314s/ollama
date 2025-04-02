# Ollama AI Development Guidelines

## Project Overview

Ollama is an open-source platform for running large language models (LLMs) locally. This document provides guidelines for AI assistants working with the Ollama codebase to ensure consistent, high-quality contributions and reduce errors.

## Core Architecture Understanding

### Key Components
1. **CLI Interface**: Command-line interface for user interactions
2. **API Server**: RESTful HTTP endpoints for model management and inference
3. **LLM Server**: Core component that manages model loading and execution
4. **Model Management**: Handles model storage, customization, and retrieval
5. **Document Processing System**: Analyzes and processes documents for enhanced interactions

### Critical Files and Directories
- `main.go`: Entry point for the application
- `cmd/`: Contains CLI command implementations
- `api/`: API type definitions and client implementation
- `llm/`: Core model server implementation
- `server/`: API server implementation
- `model/`: Model management functionality
- `app/`: Desktop application code

## Development Standards

### Go Code Standards
1. **Error Handling**: Always check and handle errors appropriately
   ```go
   if err != nil {
       return fmt.Errorf("context: %w", err)
   }
   ```

2. **Context Propagation**: Pass context through function calls for proper cancellation
   ```go
   func SomeFunction(ctx context.Context, ...) {
       // Use ctx for downstream calls
   }
   ```

3. **Logging**: Use structured logging with slog
   ```go
   slog.Info("message", "key1", value1, "key2", value2)
   ```

### Model Handling
1. **Memory Management**: Always consider VRAM and RAM requirements
   - Check system capabilities before loading models
   - Support partial offloading when appropriate
   - Release resources when models are no longer needed

2. **Quantization**: Respect model quantization settings
   - Don't modify quantization unless explicitly requested
   - Understand performance/quality tradeoffs

3. **Model Parameters**: Preserve user-defined parameters
   - Temperature, context size, top_k, top_p, etc.
   - Default to system values when not specified

### API Compatibility
1. **Request/Response Structure**: Maintain backward compatibility
   - Don't remove fields from responses
   - Add new fields as optional
   - Preserve existing field semantics

2. **Error Handling**: Use appropriate HTTP status codes
   - Return detailed error messages
   - Don't expose sensitive information

### Document Processing
1. **Metadata Preservation**: Maintain comprehensive metadata
   - Document source, type, size, timestamps
   - Chunk information and relationships

2. **Content Analysis**: Follow established extraction patterns
   - Section extraction with proper hierarchies
   - Entity recognition with consistent types
   - Structure analysis with format preservation

## Common Pitfalls to Avoid

### Performance Issues
1. **Memory Leaks**: Ensure resources are properly released
   - Close file handles
   - Release model resources
   - Clean up temporary files

2. **Excessive GPU Usage**: Optimize GPU layer allocation
   - Don't request more GPU layers than available
   - Consider mixed precision when appropriate
   - Support fallback to CPU when necessary

3. **Context Management**: Be mindful of context size limits
   - Don't exceed model's maximum context
   - Implement proper context window management
   - Handle truncation appropriately

### Configuration Errors
1. **Model Paths**: Use absolute paths or proper resolution
   - Don't assume relative paths
   - Handle spaces and special characters
   - Support cross-platform path formats

2. **Environment Variables**: Check for environment variables
   - `OLLAMA_HOST`: API server address
   - `OLLAMA_MODELS`: Model directory location
   - `OLLAMA_DEBUG`: Debug logging toggle

3. **Hardware Detection**: Properly detect and use available hardware
   - Check for CUDA/ROCm/Metal support
   - Verify GPU compatibility
   - Fallback gracefully when hardware is unavailable

### API Misuse
1. **Streaming Responses**: Handle streaming correctly
   - Process incremental responses
   - Manage connection timeouts
   - Handle early termination

2. **Concurrent Requests**: Respect server capacity
   - Implement proper rate limiting
   - Handle "no slots available" responses
   - Retry with appropriate backoff

## Testing Guidelines

1. **Unit Tests**: Write tests for core functionality
   - Test with various model sizes
   - Test with different hardware configurations
   - Test error conditions

2. **Integration Tests**: Verify component interactions
   - Test CLI to API server communication
   - Test API server to LLM server interaction
   - Test document processing pipeline

3. **Performance Testing**: Validate resource usage
   - Measure memory consumption
   - Track inference speed
   - Monitor resource leaks

## Document Processing Standards

1. **Content Extraction**:
   - Extract document sections with proper hierarchy
   - Identify entities with consistent typing
   - Preserve document structure (lists, tables, code)

2. **Metadata Management**:
   - Store comprehensive file metadata
   - Track chunk relationships
   - Maintain navigation structures

3. **Query Processing**:
   - Use proper vector similarity methods
   - Provide context-aware responses
   - Include document references

## Deployment Considerations

1. **Cross-Platform Compatibility**:
   - Support Windows, macOS, and Linux
   - Handle platform-specific optimizations
   - Manage library dependencies appropriately

2. **Container Deployment**:
   - Follow Docker best practices
   - Support GPU passthrough
   - Manage persistent storage

3. **Update Management**:
   - Handle model updates gracefully
   - Support in-place application updates
   - Preserve user configurations

## Security Guidelines

1. **Local Execution**:
   - Keep data on user's device
   - Don't send sensitive information externally
   - Respect user privacy

2. **Model Integrity**:
   - Verify model checksums
   - Support secure model sources
   - Prevent unauthorized model modification

3. **API Security**:
   - Implement proper authentication when needed
   - Validate all inputs
   - Prevent command injection

By following these guidelines, AI assistants can effectively contribute to the Ollama project while maintaining high standards of quality and consistency.
