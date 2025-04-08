package api

import (
	"encoding/json"
	"time"

	"github.com/ollama/ollama/api"
	"github.com/ollama/ollama/lmstudio/status"
)

// HuggingFaceModel represents a model from Hugging Face
type HuggingFaceModel struct {
	// ID is the Hugging Face model ID (e.g., "gpt2", "facebook/bart-large-cnn")
	ID string `json:"id"`

	// Name is a user-friendly name for the model
	Name string `json:"name"`

	// Description provides information about the model
	Description string `json:"description"`

	// Downloaded indicates if the model has been downloaded locally
	Downloaded bool `json:"downloaded"`

	// Size is the model size in bytes
	Size int64 `json:"size"`

	// DownloadProgress represents download progress (0-100)
	DownloadProgress int `json:"download_progress,omitempty"`

	// CreatedAt is when the model record was created
	CreatedAt time.Time `json:"created_at"`
}

// SystemStatus moved to lmstudio/status/types.go

// FixRequest represents a request to fix a system issue
type FixRequest struct {
	// ComponentID is the ID of the component to fix
	ComponentID string `json:"component_id"`

	// TestID is the ID of the test that failed
	TestID string `json:"test_id"`

	// Force forces the fix even if safety checks fail
	Force bool `json:"force,omitempty"`
}

// FixResponse moved to lmstudio/status/types.go

// FixResult is likely redundant now that FixResponse is in the status package.
// Keeping the definition commented out for now in case it's used elsewhere unexpectedly.
/*
// FixResult represents the result of fixing a component
type FixResult struct {
	// Success indicates if the fix was successful
	Success bool `json:"success"`

	// Message is a message describing the fix result
	Message string `json:"message"`

	// Actions are the actions taken during the fix
	Actions []string `json:"actions,omitempty"`

	// Component is the component that was fixed
	Component string `json:"component"`
}

// Marshal serializes the FixResult to JSON
func (r *FixResult) Marshal() ([]byte, error) {
	return json.Marshal(r)
}

// Unmarshal deserializes the FixResult from JSON
func (r *FixResult) Unmarshal(data []byte) error {
	return json.Unmarshal(data, r)
}
*/
