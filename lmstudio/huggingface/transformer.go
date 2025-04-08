package huggingface

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/ollama/ollama/api"
)

// TransformerManager manages Hugging Face transformer models
type TransformerManager struct {
	// Client is the Hugging Face client
	Client *Client

	// CachePath is the path to cache downloaded models
	CachePath string

	// ModelsPath is the path to Ollama models
	ModelsPath string

	// LoadedModels tracks loaded models
	LoadedModels map[string]*TransformerModel

	// Mutex protects LoadedModels
	Mutex sync.RWMutex
}

// TransformerModel represents a loaded transformer model
type TransformerModel struct {
	// ID is the model ID
	ID string

	// Process is the Python process running the model
	Process *os.Process

	// Port is the port the model is serving on
	Port int

	// Loaded indicates if the model is loaded
	Loaded bool
}

// NewTransformerManager creates a new transformer manager
func NewTransformerManager(client *Client, modelsPath string) *TransformerManager {
	return &TransformerManager{
		Client:       client,
		CachePath:    client.CachePath,
		ModelsPath:   modelsPath,
		LoadedModels: make(map[string]*TransformerModel),
	}
}

// ConvertToOllama converts a Hugging Face model to Ollama format
func (tm *TransformerManager) ConvertToOllama(ctx context.Context, modelID string) error {
	// Check if the model is downloaded
	if !tm.Client.IsModelDownloaded(modelID) {
		return fmt.Errorf("model %s is not downloaded", modelID)
	}

	// Create the conversion script
	scriptPath := filepath.Join(tm.CachePath, "convert.py")
	if err := tm.createConversionScript(scriptPath); err != nil {
		return fmt.Errorf("failed to create conversion script: %w", err)
	}

	// Run the conversion script
	cmd := exec.CommandContext(
		ctx,
		"python",
		scriptPath,
		"--model-id", modelID,
		"--input-dir", filepath.Join(tm.CachePath, modelID),
		"--output-dir", tm.ModelsPath,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to convert model: %w, output: %s", err, string(output))
	}

	return nil
}

// LoadModel loads a Hugging Face model for inference
func (tm *TransformerManager) LoadModel(ctx context.Context, modelID string, port int) (*TransformerModel, error) {
	tm.Mutex.RLock()
	model, exists := tm.LoadedModels[modelID]
	tm.Mutex.RUnlock()

	if exists && model.Loaded {
		return model, nil
	}

	// Check if the model is downloaded
	if !tm.Client.IsModelDownloaded(modelID) {
		return nil, fmt.Errorf("model %s is not downloaded", modelID)
	}

	// Create the server script
	scriptPath := filepath.Join(tm.CachePath, "serve.py")
	if err := tm.createServerScript(scriptPath); err != nil {
		return nil, fmt.Errorf("failed to create server script: %w", err)
	}

	// Start the model server
	cmd := exec.CommandContext(
		ctx,
		"python",
		scriptPath,
		"--model-id", modelID,
		"--model-dir", filepath.Join(tm.CachePath, modelID),
		"--port", fmt.Sprintf("%d", port),
	)

	// Configure the command to run in background
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start model server: %w", err)
	}

	model = &TransformerModel{
		ID:      modelID,
		Process: cmd.Process,
		Port:    port,
		Loaded:  true,
	}

	// Register the loaded model
	tm.Mutex.Lock()
	tm.LoadedModels[modelID] = model
	tm.Mutex.Unlock()

	return model, nil
}

// UnloadModel unloads a loaded model
func (tm *TransformerManager) UnloadModel(modelID string) error {
	tm.Mutex.RLock()
	model, exists := tm.LoadedModels[modelID]
	tm.Mutex.RUnlock()

	if !exists || !model.Loaded {
		return nil
	}

	// Kill the model process
	if err := model.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill model process: %w", err)
	}

	// Update the model status
	tm.Mutex.Lock()
	tm.LoadedModels[modelID].Loaded = false
	tm.Mutex.Unlock()

	return nil
}

// Generate generates text using a loaded model
func (tm *TransformerManager) Generate(ctx context.Context, modelID string, request *api.GenerateRequest) (*api.GenerateResponse, error) {
	tm.Mutex.RLock()
	model, exists := tm.LoadedModels[modelID]
	tm.Mutex.RUnlock()

	if !exists || !model.Loaded {
		return nil, fmt.Errorf("model %s is not loaded", modelID)
	}

	// TODO: Implement actual generation by calling the Python API server
	// This is a placeholder implementation
	response := &api.GenerateResponse{
		Model:     modelID,
		Response:  "This is a generated response from the transformer model.",
		Done:      true,
		Context:   []int{1, 2, 3}, // Placeholder context
		TotalDuration: 100,
		LoadDuration:  50,
		PromptEvalCount: 10,
		PromptEvalDuration: 20,
		EvalCount: 30,
		EvalDuration: 30,
	}

	return response, nil
}

// createConversionScript creates a Python script for converting models
func (tm *TransformerManager) createConversionScript(path string) error {
	script := `
import argparse
import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from safetensors.torch import save_file

def convert_model(model_id, input_dir, output_dir):
    print(f"Converting model {model_id} from {input_dir} to {output_dir}")
    
    # Load model and tokenizer
    model = AutoModelForCausalLM.from_pretrained(input_dir)
    tokenizer = AutoTokenizer.from_pretrained(input_dir)
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Convert to GGUF format (simplified for this implementation)
    # In a real implementation, we would use GGUF conversion libraries
    
    # For now, we'll just save the model state dict in safetensors format
    model_path = os.path.join(output_dir, f"{model_id.replace('/', '_')}.safetensors")
    state_dict = model.state_dict()
    save_file(state_dict, model_path)
    
    # Save tokenizer
    tokenizer.save_pretrained(output_dir)
    
    # Create a modelfile for Ollama
    with open(os.path.join(output_dir, "Modelfile"), "w") as f:
        f.write(f"""
FROM {model_id.replace('/', '_')}.safetensors
TEMPLATE """
<s>{{ .System }}</s>
<s>{{ .Prompt }}</s>
<s>{{ .Response }}</s>
"""
PARAMETER stop "<s>"
PARAMETER stop "</s>"
""")
    
    print(f"Model converted and saved to {output_dir}")
    return model_path

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert Hugging Face models to Ollama format")
    parser.add_argument("--model-id", required=True, help="Hugging Face model ID")
    parser.add_argument("--input-dir", required=True, help="Input directory with the downloaded model")
    parser.add_argument("--output-dir", required=True, help="Output directory for the converted model")
    args = parser.parse_args()
    
    convert_model(args.model_id, args.input_dir, args.output_dir)
`

	return os.WriteFile(path, []byte(script), 0755)
}

// createServerScript creates a Python script for serving models
func (tm *TransformerManager) createServerScript(path string) error {
	script := `
import argparse
import json
import os
from flask import Flask, request, jsonify
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

app = Flask(__name__)
model = None
tokenizer = None

@app.route('/v1/generate', methods=['POST'])
def generate():
    global model, tokenizer
    
    try:
        data = request.json
        prompt = data.get('prompt', '')
        
        # Get generation parameters
        max_tokens = data.get('max_tokens', 100)
        temperature = data.get('temperature', 0.7)
        top_p = data.get('top_p', 0.9)
        
        # Generate text
        inputs = tokenizer(prompt, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model.generate(
                inputs.input_ids,
                max_length=inputs.input_ids.shape[1] + max_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=temperature > 0,
            )
        
        # Decode the generated tokens
        generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        response_text = generated_text[len(prompt):]
        
        return jsonify({
            'response': response_text,
            'model': model_id,
            'prompt_eval_count': inputs.input_ids.shape[1],
            'eval_count': outputs.shape[1] - inputs.input_ids.shape[1],
            'done': True
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/v1/chat', methods=['POST'])
def chat():
    global model, tokenizer
    
    try:
        data = request.json
        messages = data.get('messages', [])
        
        # Convert messages to a single prompt
        prompt = ""
        for msg in messages:
            role = msg.get('role', '')
            content = msg.get('content', '')
            prompt += f"<s>{role}: {content}</s>\\n"
        
        prompt += "<s>assistant: "
        
        # Get generation parameters
        max_tokens = data.get('max_tokens', 100)
        temperature = data.get('temperature', 0.7)
        top_p = data.get('top_p', 0.9)
        
        # Generate text
        inputs = tokenizer(prompt, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model.generate(
                inputs.input_ids,
                max_length=inputs.input_ids.shape[1] + max_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=temperature > 0,
            )
        
        # Decode the generated tokens
        generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        response_text = generated_text[len(prompt):]
        
        return jsonify({
            'message': {
                'role': 'assistant',
                'content': response_text
            },
            'model': model_id,
            'done': True
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Serve a Hugging Face model")
    parser.add_argument("--model-id", required=True, help="Hugging Face model ID")
    parser.add_argument("--model-dir", required=True, help="Directory containing the model files")
    parser.add_argument("--port", type=int, default=8000, help="Port to serve on")
    args = parser.parse_args()
    
    global model_id
    model_id = args.model_id
    
    print(f"Loading model {args.model_id} from {args.model_dir}")
    model = AutoModelForCausalLM.from_pretrained(args.model_dir)
    tokenizer = AutoTokenizer.from_pretrained(args.model_dir)
    print(f"Model loaded, serving on port {args.port}")
    
    app.run(host='0.0.0.0', port=args.port)
`

	return os.WriteFile(path, []byte(script), 0755)
}
