package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"time"

	"github.com/ollama/ollama/lmstudio/api"
	"github.com/ollama/ollama/lmstudio/status"
)

// OllamaTestRunner tests the Ollama integration
type OllamaTestRunner struct {
	// BaseURL is the base URL of the Ollama API
	BaseURL string
}

// NewOllamaTestRunner creates a new Ollama test runner
func NewOllamaTestRunner(baseURL string) *OllamaTestRunner {
	return &OllamaTestRunner{
		BaseURL: baseURL,
	}
}

// Run runs the Ollama test
func (r *OllamaTestRunner) Run(ctx context.Context) (*status.TestResult, error) {
	startTime := time.Now()
	testID := "ollama_connectivity"
	testName := "Ollama Connectivity Test"

	// Create a test result
	result := &status.TestResult{
		ID:       testID,
		Name:     testName,
		Status:   "running",
		Message:  "Test in progress",
		Duration: 0,
		RunAt:    startTime,
	}

	// Test Ollama command availability
	if _, err := exec.LookPath("ollama"); err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Ollama command not found: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = true
		return result, nil
	}

	// Test Ollama API connectivity
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	// Check if the Ollama API is reachable
	modelsURL := fmt.Sprintf("%s/api/tags", r.BaseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", modelsURL, nil)
	if err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Failed to create request: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = true
		return result, nil
	}

	// Execute the request
	resp, err := client.Do(req)
	if err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Failed to connect to Ollama API: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = true
		return result, nil
	}
	defer resp.Body.Close()

	// Check if the response is OK
	if resp.StatusCode != http.StatusOK {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Ollama API returned unexpected status code: %d", resp.StatusCode)
		result.Duration = time.Since(startTime)
		result.FixAvailable = true
		return result, nil
	}

	// Try to parse the response
	var response struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Failed to parse Ollama API response: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = true
		return result, nil
	}

	// Test passed
	result.Status = "passed"
	result.Message = "Ollama integration is operational"
	result.Duration = time.Since(startTime)
	result.FixAvailable = false
	return result, nil
}

// OllamaFixer fixes Ollama integration issues
type OllamaFixer struct {
	// OllamaPath is the path to the Ollama executable
	OllamaPath string
}

// NewOllamaFixer creates a new Ollama fixer
func NewOllamaFixer(ollamaPath string) *OllamaFixer {
	return &OllamaFixer{
		OllamaPath: ollamaPath,
	}
}

// Fix attempts to fix Ollama integration issues
func (f *OllamaFixer) Fix(ctx context.Context, componentID string) (bool, []string, error) {
	// Check if the component ID is correct
	if componentID != "ollama" {
		return false, nil, fmt.Errorf("unexpected component ID: %s", componentID)
	}

	actions := []string{}

	// Check if Ollama is installed
	ollamaPath, err := exec.LookPath("ollama")
	if err != nil {
		actions = append(actions, "Ollama command not found in PATH")
		actions = append(actions, "Please install Ollama: https://ollama.com/download")
		return false, actions, nil
	}
	actions = append(actions, fmt.Sprintf("Found Ollama at: %s", ollamaPath))

	// Check if Ollama server is running
	cmd := exec.CommandContext(ctx, "ollama", "ps")
	if err := cmd.Run(); err != nil {
		// Try to start the Ollama server
		actions = append(actions, "Ollama server is not running")
		
		startCmd := exec.CommandContext(ctx, "ollama", "serve")
		if err := startCmd.Start(); err != nil {
			actions = append(actions, fmt.Sprintf("Failed to start Ollama server: %v", err))
			return false, actions, nil
		}
		
		// Wait for the server to start
		time.Sleep(2 * time.Second)
		actions = append(actions, "Started Ollama server")
		
		// Check if the server is now running
		checkCmd := exec.CommandContext(ctx, "ollama", "ps")
		if err := checkCmd.Run(); err != nil {
			actions = append(actions, "Ollama server failed to start")
			return false, actions, nil
		}
	} else {
		actions = append(actions, "Ollama server is already running")
	}

	return true, actions, nil
}
