# LM Studio Integration for Ollama

This extension adds LM Studio-like capabilities to Ollama, including:

1. **Hugging Face Integration**: Load models directly from Hugging Face using transformers
2. **Status Tracker**: Monitor the health and status of all APIs, models, and functions
3. **Test Suite**: Comprehensive tests for all components with self-healing capabilities

## Directory Structure

```
lmstudio/
├── api/               # Extension API endpoints
├── huggingface/       # Hugging Face integration
├── models/            # Model management
├── server/            # Web server for the UI
├── status/            # Status tracking system
├── tests/             # Test modules
└── ui/                # Web UI
```

## Getting Started

1. Start the server: `go run ./lmstudio/server`
2. Access the UI: http://localhost:3000
3. View the status dashboard: http://localhost:3000/status

## Features

- Load models from Hugging Face using transformers
- Use models through the Ollama API
- Monitor system health and status
- Run tests to verify functionality
- Auto-fix common issues
