package status

import (
	"encoding/json"
	"time"
)

// TestResult represents the result of a test
type TestResult struct {
	// ID is the unique identifier for the test
	ID string `json:"id"`

	// Name is the name of the test
	Name string `json:"name"`

	// Status is the status of the test (running, passed, failed)
	Status string `json:"status"`

	// Message is a message describing the test result
	Message string `json:"message"`

	// Duration is the duration of the test in nanoseconds
	Duration time.Duration `json:"duration"`

	// RunAt is the time the test was run
	RunAt time.Time `json:"run_at"`

	// FixAvailable indicates if a fix is available for this test
	FixAvailable bool `json:"fix_available"`
}

// Marshal serializes the TestResult to JSON
func (r *TestResult) Marshal() ([]byte, error) {
	return json.Marshal(r)
}

// Unmarshal deserializes the TestResult from JSON
func (r *TestResult) Unmarshal(data []byte) error {
	return json.Unmarshal(data, r)
}

// ComponentStatus represents the status of a system component
type ComponentStatus struct {
	// ID is the unique identifier for the component
	ID string `json:"id"`

	// Name is the name of the component
	Name string `json:"name"`

	// Status is the status of the component (operational, degraded, offline)
	Status string `json:"status"`

	// Message is a message describing the component status
	Message string `json:"message"`

	// LastChecked is the time the component was last checked
	LastChecked time.Time `json:"last_checked"`

	// TestResults are the results of tests run on the component
	TestResults []*TestResult `json:"test_results,omitempty"`
}

// Marshal serializes the ComponentStatus to JSON
func (s *ComponentStatus) Marshal() ([]byte, error) {
	return json.Marshal(s)
}

// Unmarshal deserializes the ComponentStatus from JSON
func (s *ComponentStatus) Unmarshal(data []byte) error {
	return json.Unmarshal(data, s)
}

// SystemStatus represents the overall system status
type SystemStatus struct {
	// Status is the overall system status (operational, degraded, offline)
	Status string `json:"status"`

	// Components contains the status of individual system components
	Components map[string]ComponentStatus `json:"components"`

	// Tests contains recent test results
	Tests []*TestResult `json:"tests"`

	// UpdatedAt is when the status was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// Marshal serializes the SystemStatus to JSON
func (s *SystemStatus) Marshal() ([]byte, error) {
	return json.Marshal(s)
}

// Unmarshal deserializes the SystemStatus from JSON
func (s *SystemStatus) Unmarshal(data []byte) error {
	return json.Unmarshal(data, s)
}

// FixResponse represents the response to a fix request
type FixResponse struct {
	// Success indicates if the fix was successful
	Success bool `json:"success"`

	// Message provides additional information
	Message string `json:"message"`

	// Actions contains actions taken during the fix
	Actions []string `json:"actions"`

	// NewStatus is the new component status
	NewStatus ComponentStatus `json:"new_status"`
}
