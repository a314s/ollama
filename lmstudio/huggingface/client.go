package huggingface

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/ollama/ollama/lmstudio/api"
)

// Client represents a client for interacting with the Hugging Face API
type Client struct {
	// HTTPClient is the underlying HTTP client
	HTTPClient *http.Client

	// APIToken is the Hugging Face API token (optional)
	APIToken string

	// BaseURL is the base URL for the Hugging Face API
	BaseURL string

	// CachePath is the path to cache downloaded models
	CachePath string
}

// NewClient creates a new Hugging Face client
func NewClient(apiToken string, cachePath string) *Client {
	return &Client{
		HTTPClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		APIToken:  apiToken,
		BaseURL:   "https://huggingface.co/api",
		CachePath: cachePath,
	}
}

// SearchModels searches for models on Hugging Face
func (c *Client) SearchModels(ctx context.Context, query string, limit int) ([]api.HuggingFaceModel, error) {
	url := fmt.Sprintf("%s/models?search=%s&limit=%d", c.BaseURL, query, limit)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	if c.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIToken)
	}
	
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	
	var result []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	models := make([]api.HuggingFaceModel, 0, len(result))
	for _, m := range result {
		model := api.HuggingFaceModel{
			ID:          m["id"].(string),
			Name:        m["id"].(string),
			Description: fmt.Sprintf("%v", m["description"]),
			CreatedAt:   time.Now(),
		}
		
		// Check if the model exists locally
		model.Downloaded = c.IsModelDownloaded(model.ID)
		
		models = append(models, model)
	}
	
	return models, nil
}

// GetModel retrieves a model by ID
func (c *Client) GetModel(ctx context.Context, id string) (*api.HuggingFaceModel, error) {
	url := fmt.Sprintf("%s/models/%s", c.BaseURL, id)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	if c.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIToken)
	}
	
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	model := &api.HuggingFaceModel{
		ID:          id,
		Name:        id,
		Description: fmt.Sprintf("%v", result["description"]),
		CreatedAt:   time.Now(),
	}
	
	// Check if the model exists locally
	model.Downloaded = c.IsModelDownloaded(id)
	
	return model, nil
}

// DownloadModel downloads a model from Hugging Face
func (c *Client) DownloadModel(ctx context.Context, id string, progressCallback func(int)) error {
	// Create the cache directory if it doesn't exist
	if err := os.MkdirAll(c.CachePath, 0755); err != nil {
		return fmt.Errorf("failed to create cache directory: %w", err)
	}
	
	// Download model configuration
	configURL := fmt.Sprintf("https://huggingface.co/%s/resolve/main/config.json", id)
	configPath := filepath.Join(c.CachePath, id, "config.json")
	
	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		return fmt.Errorf("failed to create model directory: %w", err)
	}
	
	if err := c.downloadFile(ctx, configURL, configPath, nil); err != nil {
		return fmt.Errorf("failed to download config: %w", err)
	}
	
	// Download model weights
	weightsURL := fmt.Sprintf("https://huggingface.co/%s/resolve/main/model.safetensors", id)
	weightsPath := filepath.Join(c.CachePath, id, "model.safetensors")
	
	if err := c.downloadFile(ctx, weightsURL, weightsPath, progressCallback); err != nil {
		// Try alternative format
		weightsURL = fmt.Sprintf("https://huggingface.co/%s/resolve/main/pytorch_model.bin", id)
		weightsPath = filepath.Join(c.CachePath, id, "pytorch_model.bin")
		
		if err := c.downloadFile(ctx, weightsURL, weightsPath, progressCallback); err != nil {
			return fmt.Errorf("failed to download weights: %w", err)
		}
	}
	
	// Download tokenizer files
	tokenizerURL := fmt.Sprintf("https://huggingface.co/%s/resolve/main/tokenizer.json", id)
	tokenizerPath := filepath.Join(c.CachePath, id, "tokenizer.json")
	
	if err := c.downloadFile(ctx, tokenizerURL, tokenizerPath, nil); err != nil {
		// Try alternative format
		tokenizerURL = fmt.Sprintf("https://huggingface.co/%s/resolve/main/tokenizer_config.json", id)
		tokenizerPath = filepath.Join(c.CachePath, id, "tokenizer_config.json")
		
		if err := c.downloadFile(ctx, tokenizerURL, tokenizerPath, nil); err != nil {
			// Some models don't have tokenizer files, so we'll just log a warning
			fmt.Printf("Warning: Failed to download tokenizer for %s\n", id)
		}
	}
	
	return nil
}

// IsModelDownloaded checks if a model is downloaded
func (c *Client) IsModelDownloaded(id string) bool {
	modelDir := filepath.Join(c.CachePath, id)
	
	// Check if the model directory exists
	if _, err := os.Stat(modelDir); os.IsNotExist(err) {
		return false
	}
	
	// Check if the model weights exist
	weightsPath := filepath.Join(modelDir, "model.safetensors")
	if _, err := os.Stat(weightsPath); !os.IsNotExist(err) {
		return true
	}
	
	weightsPath = filepath.Join(modelDir, "pytorch_model.bin")
	if _, err := os.Stat(weightsPath); !os.IsNotExist(err) {
		return true
	}
	
	return false
}

// downloadFile downloads a file from a URL
func (c *Client) downloadFile(ctx context.Context, url, path string, progressCallback func(int)) error {
	// Create the parent directory if it doesn't exist
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}
	
	// Create the request
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	if c.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIToken)
	}
	
	// Execute the request
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	
	// Create the file
	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()
	
	// Download the file with progress reporting
	if progressCallback != nil && resp.ContentLength > 0 {
		// Create a proxy reader that reports progress
		var downloaded int64
		reader := io.TeeReader(resp.Body, &progressWriter{
			downloaded:       &downloaded,
			totalSize:        resp.ContentLength,
			progressCallback: progressCallback,
		})
		
		if _, err := io.Copy(file, reader); err != nil {
			return fmt.Errorf("failed to download file: %w", err)
		}
	} else {
		// Simple download without progress reporting
		if _, err := io.Copy(file, resp.Body); err != nil {
			return fmt.Errorf("failed to download file: %w", err)
		}
	}
	
	return nil
}

// progressWriter is an io.Writer that reports download progress
type progressWriter struct {
	downloaded       *int64
	totalSize        int64
	progressCallback func(int)
	lastReported     int
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	n := len(p)
	*pw.downloaded += int64(n)
	
	// Calculate progress percentage
	progress := int(*pw.downloaded * 100 / pw.totalSize)
	
	// Only report if progress has changed
	if progress != pw.lastReported {
		pw.progressCallback(progress)
		pw.lastReported = progress
	}
	
	return n, nil
}
