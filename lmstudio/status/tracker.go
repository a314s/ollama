package status

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/ollama/ollama/lmstudio/api"
)

// Tracker tracks the status of system components
type Tracker struct {
	// Components is a map of component IDs to their status
	Components map[string]*api.ComponentStatus

	// Tests is a map of test IDs to their results
	Tests map[string]*api.TestResult

	// StatusFilePath is the path to the status file
	StatusFilePath string

	// Mutex protects Components and Tests
	Mutex sync.RWMutex

	// Fixers is a map of component IDs to their fixers
	Fixers map[string]Fixer

	// TestRunners is a map of test IDs to their runners
	TestRunners map[string]TestRunner
}

// Fixer defines an interface for fixing components
type Fixer interface {
	// Fix attempts to fix a component
	Fix(ctx context.Context, componentID string) (bool, []string, error)
}

// TestRunner defines an interface for running tests
type TestRunner interface {
	// Run runs a test
	Run(ctx context.Context) (*api.TestResult, error)
}

// NewTracker creates a new status tracker
func NewTracker(dataDir string) (*Tracker, error) {
	statusFilePath := filepath.Join(dataDir, "status.json")

	// Create the data directory if it doesn't exist
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	tracker := &Tracker{
		Components:    make(map[string]*api.ComponentStatus),
		Tests:         make(map[string]*api.TestResult),
		StatusFilePath: statusFilePath,
		Fixers:        make(map[string]Fixer),
		TestRunners:   make(map[string]TestRunner),
	}

	// Load the existing status if available
	if err := tracker.loadStatus(); err != nil {
		// Initialize default components and tests if the status file doesn't exist
		tracker.initializeDefaults()
	}

	return tracker, nil
}

// loadStatus loads the status from the status file
func (t *Tracker) loadStatus() error {
	// Check if the status file exists
	if _, err := os.Stat(t.StatusFilePath); os.IsNotExist(err) {
		return fmt.Errorf("status file does not exist")
	}

	// Read the status file
	data, err := os.ReadFile(t.StatusFilePath)
	if err != nil {
		return fmt.Errorf("failed to read status file: %w", err)
	}

	// Parse the status file
	var status struct {
		Components map[string]*api.ComponentStatus `json:"components"`
		Tests      map[string]*api.TestResult      `json:"tests"`
	}

	if err := json.Unmarshal(data, &status); err != nil {
		return fmt.Errorf("failed to parse status file: %w", err)
	}

	// Update the tracker
	t.Mutex.Lock()
	t.Components = status.Components
	t.Tests = status.Tests
	t.Mutex.Unlock()

	return nil
}

// saveStatus saves the status to the status file
func (t *Tracker) saveStatus() error {
	// Create the status data
	t.Mutex.RLock()
	status := struct {
		Components map[string]*api.ComponentStatus `json:"components"`
		Tests      map[string]*api.TestResult      `json:"tests"`
	}{
		Components: t.Components,
		Tests:      t.Tests,
	}
	t.Mutex.RUnlock()

	// Marshal the status data
	data, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal status: %w", err)
	}

	// Write the status file
	if err := os.WriteFile(t.StatusFilePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write status file: %w", err)
	}

	return nil
}

// initializeDefaults initializes default components and tests
func (t *Tracker) initializeDefaults() {
	now := time.Now()

	// Initialize default components
	t.Mutex.Lock()
	defer t.Mutex.Unlock()

	// Core components
	t.Components["api"] = &api.ComponentStatus{
		Name:        "API Server",
		Status:      "unknown",
		Message:     "Status not yet checked",
		LastChecked: now,
	}

	t.Components["ollama"] = &api.ComponentStatus{
		Name:        "Ollama Integration",
		Status:      "unknown",
		Message:     "Status not yet checked",
		LastChecked: now,
	}

	t.Components["huggingface"] = &api.ComponentStatus{
		Name:        "Hugging Face Integration",
		Status:      "unknown",
		Message:     "Status not yet checked",
		LastChecked: now,
	}

	t.Components["documents"] = &api.ComponentStatus{
		Name:        "Document Processing",
		Status:      "unknown",
		Message:     "Status not yet checked",
		LastChecked: now,
	}

	// Initialize default tests
	t.Tests["api_connectivity"] = &api.TestResult{
		ID:           "api_connectivity",
		Name:         "API Connectivity Test",
		Status:       "not_run",
		Message:      "Test not yet run",
		Duration:     0,
		FixAvailable: true,
		RunAt:        now,
	}

	t.Tests["ollama_connectivity"] = &api.TestResult{
		ID:           "ollama_connectivity",
		Name:         "Ollama Connectivity Test",
		Status:       "not_run",
		Message:      "Test not yet run",
		Duration:     0,
		FixAvailable: true,
		RunAt:        now,
	}

	t.Tests["huggingface_connectivity"] = &api.TestResult{
		ID:           "huggingface_connectivity",
		Name:         "Hugging Face Connectivity Test",
		Status:       "not_run",
		Message:      "Test not yet run",
		Duration:     0,
		FixAvailable: true,
		RunAt:        now,
	}

	t.Tests["document_processing"] = &api.TestResult{
		ID:           "document_processing",
		Name:         "Document Processing Test",
		Status:       "not_run",
		Message:      "Test not yet run",
		Duration:     0,
		FixAvailable: true,
		RunAt:        now,
	}

	// Save the default status
	t.saveStatus()
}

// RegisterFixer registers a fixer for a component
func (t *Tracker) RegisterFixer(componentID string, fixer Fixer) {
	t.Mutex.Lock()
	defer t.Mutex.Unlock()

	t.Fixers[componentID] = fixer
}

// RegisterTestRunner registers a test runner
func (t *Tracker) RegisterTestRunner(testID string, runner TestRunner) {
	t.Mutex.Lock()
	defer t.Mutex.Unlock()

	t.TestRunners[testID] = runner
}

// GetSystemStatus returns the current system status
func (t *Tracker) GetSystemStatus() *api.SystemStatus {
	t.Mutex.RLock()
	defer t.Mutex.RUnlock()

	// Calculate overall status
	status := "operational"
	for _, comp := range t.Components {
		if comp.Status == "offline" {
			status = "offline"
			break
		} else if comp.Status == "degraded" {
			status = "degraded"
		}
	}

	// Create the system status
	systemStatus := &api.SystemStatus{
		Status:     status,
		Components: make(map[string]api.ComponentStatus),
		Tests:      make([]api.TestResult, 0, len(t.Tests)),
		UpdatedAt:  time.Now(),
	}

	// Copy components
	for id, comp := range t.Components {
		systemStatus.Components[id] = *comp
	}

	// Copy tests
	for _, test := range t.Tests {
		systemStatus.Tests = append(systemStatus.Tests, *test)
	}

	return systemStatus
}

// UpdateComponentStatus updates the status of a component
func (t *Tracker) UpdateComponentStatus(id string, status string, message string) error {
	t.Mutex.Lock()
	defer t.Mutex.Unlock()

	// Check if the component exists
	comp, exists := t.Components[id]
	if !exists {
		return fmt.Errorf("component %s does not exist", id)
	}

	// Update the component
	comp.Status = status
	comp.Message = message
	comp.LastChecked = time.Now()

	// Save the status
	return t.saveStatus()
}

// UpdateTestResult updates the result of a test
func (t *Tracker) UpdateTestResult(result *api.TestResult) error {
	t.Mutex.Lock()
	defer t.Mutex.Unlock()

	// Check if the test exists
	_, exists := t.Tests[result.ID]
	if !exists {
		return fmt.Errorf("test %s does not exist", result.ID)
	}

	// Update the test
	t.Tests[result.ID] = result

	// Save the status
	return t.saveStatus()
}

// RunTest runs a specific test
func (t *Tracker) RunTest(ctx context.Context, id string) (*api.TestResult, error) {
	// Check if the test exists and has a runner
	t.Mutex.RLock()
	test, exists := t.Tests[id]
	if !exists {
		t.Mutex.RUnlock()
		return nil, fmt.Errorf("test %s does not exist", id)
	}

	runner, hasRunner := t.TestRunners[id]
	t.Mutex.RUnlock()

	if !hasRunner {
		return nil, fmt.Errorf("test %s has no runner", id)
	}

	// Run the test
	startTime := time.Now()
	result, err := runner.Run(ctx)
	if err != nil {
		// Update the test result with the error
		result = &api.TestResult{
			ID:           id,
			Name:         test.Name,
			Status:       "failed",
			Message:      fmt.Sprintf("Error running test: %v", err),
			Duration:     time.Since(startTime),
			FixAvailable: test.FixAvailable,
			RunAt:        time.Now(),
		}

		// Save the result
		t.UpdateTestResult(result)
		return result, err
	}

	// Save the result
	t.UpdateTestResult(result)
	return result, nil
}

// RunAllTests runs all registered tests
func (t *Tracker) RunAllTests(ctx context.Context) ([]*api.TestResult, error) {
	// Get all test IDs
	t.Mutex.RLock()
	testIDs := make([]string, 0, len(t.Tests))
	for id := range t.Tests {
		testIDs = append(testIDs, id)
	}
	t.Mutex.RUnlock()

	// Run all tests
	results := make([]*api.TestResult, 0, len(testIDs))
	for _, id := range testIDs {
		result, err := t.RunTest(ctx, id)
		if err != nil {
			// Continue running tests even if one fails
			fmt.Printf("Error running test %s: %v\n", id, err)
		}
		results = append(results, result)
	}

	return results, nil
}

// FixComponent attempts to fix a component
func (t *Tracker) FixComponent(ctx context.Context, id string, force bool) (*api.FixResponse, error) {
	// Check if the component exists and has a fixer
	t.Mutex.RLock()
	comp, exists := t.Components[id]
	if !exists {
		t.Mutex.RUnlock()
		return nil, fmt.Errorf("component %s does not exist", id)
	}

	fixer, hasFixer := t.Fixers[id]
	t.Mutex.RUnlock()

	if !hasFixer {
		return nil, fmt.Errorf("component %s has no fixer", id)
	}

	// Check if the component needs fixing
	if comp.Status == "operational" && !force {
		return &api.FixResponse{
			Success:   true,
			Message:   "Component is already operational",
			Actions:   []string{"No action taken"},
			NewStatus: *comp,
		}, nil
	}

	// Fix the component
	success, actions, err := fixer.Fix(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to fix component %s: %w", id, err)
	}

	// Update the component status
	status := "operational"
	message := "Component fixed successfully"
	if !success {
		status = "degraded"
		message = "Component partially fixed"
	}

	if err := t.UpdateComponentStatus(id, status, message); err != nil {
		return nil, fmt.Errorf("failed to update component status: %w", err)
	}

	// Get the updated component
	t.Mutex.RLock()
	updatedComp := t.Components[id]
	t.Mutex.RUnlock()

	return &api.FixResponse{
		Success:   success,
		Message:   message,
		Actions:   actions,
		NewStatus: *updatedComp,
	}, nil
}
