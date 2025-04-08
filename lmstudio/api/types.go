package api

import (
	"encoding/json"
	"time"

	"github.com/ollama/ollama/api"
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

// SystemStatus represents the overall system status
type SystemStatus struct {
	// Status is the overall system status (operational, degraded, offline)
	Status string `json:"status"`

	// Components contains the status of individual system components
	Components map[string]ComponentStatus `json:"components"`

	// Tests contains recent test results
	Tests []TestResult `json:"tests"`

	// UpdatedAt is when the status was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ComponentStatus represents the status of a system component
type ComponentStatus struct {
	// Name is the component name
	Name string `json:"name"`

	// Status is the component status (operational, degraded, offline)
	Status string `json:"status"`

	// Message provides additional status information
	Message string `json:"message,omitempty"`

	// LastChecked is when the component was last checked
	LastChecked time.Time `json:"last_checked"`
}

// TestResult represents the result of a system test
type TestResult struct {
	// ID is the test ID
	ID string `json:"id"`

	// Name is a user-friendly test name
	Name string `json:"name"`

	// Status is the test status (passed, failed, skipped)
	Status string `json:"status"`

	// Duration is how long the test took to run
	Duration time.Duration `json:"duration"`

	// Message provides additional test information
	Message string `json:"message,omitempty"`

	// FixAvailable indicates if an automated fix is available
	FixAvailable bool `json:"fix_available"`

	// RunAt is when the test was run
	RunAt time.Time `json:"run_at"`
}

// DocumentMetadata represents document metadata
type DocumentMetadata struct {
	// ID is the document ID
	ID string `json:"id"`

	// Filename is the original document filename
	Filename string `json:"filename"`

	// Filetype is the document file type
	Filetype string `json:"filetype"`

	// Filesize is the document size in bytes
	Filesize int64 `json:"filesize"`

	// OriginalPath is the original document path
	OriginalPath string `json:"original_path,omitempty"`

	// UploadDate is when the document was uploaded
	UploadDate time.Time `json:"upload_date"`

	// LastModifiedDate is when the document was last modified
	LastModifiedDate time.Time `json:"last_modified_date"`

	// WordCount is the document word count
	WordCount int `json:"word_count"`

	// EstimatedPages is the estimated number of pages
	EstimatedPages int `json:"estimated_pages"`

	// ContentSummary is a summary of the document content
	ContentSummary string `json:"content_summary"`
}

// DocumentAnalysis represents document analysis results
type DocumentAnalysis struct {
	// ID is the document ID
	ID string `json:"id"`

	// Sections contains document sections
	Sections []DocumentSection `json:"sections"`

	// Entities contains extracted entities
	Entities []DocumentEntity `json:"entities"`

	// Topics contains extracted topics
	Topics []DocumentTopic `json:"topics"`

	// TableOfContents is the document table of contents
	TableOfContents []TOCEntry `json:"table_of_contents"`

	// AnalyzedAt is when the analysis was performed
	AnalyzedAt time.Time `json:"analyzed_at"`
}

// DocumentSection represents a document section
type DocumentSection struct {
	// Index is the section index
	Index int `json:"index"`

	// Heading is the section heading
	Heading string `json:"heading"`

	// Content is the section content
	Content string `json:"content"`

	// StartPosition is the section start position
	StartPosition int `json:"start_position"`

	// Length is the section length
	Length int `json:"length"`
}

// DocumentEntity represents an entity extracted from a document
type DocumentEntity struct {
	// Type is the entity type (email, date, organization, etc.)
	Type string `json:"type"`

	// Value is the entity value
	Value string `json:"value"`

	// Position is the entity position in the document
	Position int `json:"position"`
}

// DocumentTopic represents a topic extracted from a document
type DocumentTopic struct {
	// Name is the topic name
	Name string `json:"name"`

	// Weight is the topic weight/relevance score
	Weight float64 `json:"weight"`

	// Keywords are keywords associated with the topic
	Keywords []string `json:"keywords"`
}

// TOCEntry represents a table of contents entry
type TOCEntry struct {
	// Level is the heading level (1-6)
	Level int `json:"level"`

	// Title is the heading title
	Title string `json:"title"`

	// Position is the heading position in the document
	Position int `json:"position"`
}

// FixRequest represents a request to fix a system issue
type FixRequest struct {
	// ComponentID is the ID of the component to fix
	ComponentID string `json:"component_id"`

	// TestID is the ID of the test that failed
	TestID string `json:"test_id"`

	// Force forces the fix even if safety checks fail
	Force bool `json:"force,omitempty"`
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

// SystemStatus represents the overall status of the system
type SystemStatus struct {
	// Status is the overall status of the system (operational, degraded, offline)
	Status string `json:"status"`

	// Components are the statuses of individual components
	Components map[string]*ComponentStatus `json:"components"`

	// Tests are the results of tests run on the system
	Tests []*TestResult `json:"tests"`

	// UpdatedAt is the time the status was updated
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

// DocumentMetadata contains metadata about a document
type DocumentMetadata struct {
	// ID is the unique identifier for the document
	ID string `json:"id"`

	// Filename is the name of the document file
	Filename string `json:"filename"`

	// Filetype is the type of the document file
	Filetype string `json:"filetype"`

	// Filesize is the size of the document file in bytes
	Filesize int64 `json:"filesize"`

	// OriginalPath is the original path of the document file
	OriginalPath string `json:"original_path"`

	// UploadDate is the date the document was uploaded
	UploadDate time.Time `json:"upload_date"`

	// LastModifiedDate is the date the document was last modified
	LastModifiedDate time.Time `json:"last_modified_date"`

	// WordCount is the number of words in the document
	WordCount int `json:"word_count"`

	// EstimatedPages is the estimated number of pages in the document
	EstimatedPages int `json:"estimated_pages"`

	// ContentSummary is a summary of the document content
	ContentSummary string `json:"content_summary"`
}

// Marshal serializes the DocumentMetadata to JSON
func (m *DocumentMetadata) Marshal() ([]byte, error) {
	return json.Marshal(m)
}

// Unmarshal deserializes the DocumentMetadata from JSON
func (m *DocumentMetadata) Unmarshal(data []byte) error {
	return json.Unmarshal(data, m)
}

// DocumentSection represents a section in a document
type DocumentSection struct {
	// Index is the index of the section
	Index int `json:"index"`

	// Heading is the heading of the section
	Heading string `json:"heading"`

	// HeadingLevel is the level of the heading
	HeadingLevel int `json:"heading_level"`

	// Content is the content of the section
	Content string `json:"content"`

	// StartPosition is the position of the start of the section
	StartPosition int `json:"start_position"`

	// Length is the length of the section
	Length int `json:"length"`
}

// Marshal serializes the DocumentSection to JSON
func (s *DocumentSection) Marshal() ([]byte, error) {
	return json.Marshal(s)
}

// Unmarshal deserializes the DocumentSection from JSON
func (s *DocumentSection) Unmarshal(data []byte) error {
	return json.Unmarshal(data, s)
}

// DocumentEntity represents an entity extracted from a document
type DocumentEntity struct {
	// Type is the type of the entity
	Type string `json:"type"`

	// Value is the value of the entity
	Value string `json:"value"`

	// Position is the position of the entity in the document
	Position int `json:"position"`
}

// Marshal serializes the DocumentEntity to JSON
func (e *DocumentEntity) Marshal() ([]byte, error) {
	return json.Marshal(e)
}

// Unmarshal deserializes the DocumentEntity from JSON
func (e *DocumentEntity) Unmarshal(data []byte) error {
	return json.Unmarshal(data, e)
}

// DocumentTopic represents a topic extracted from a document
type DocumentTopic struct {
	// Name is the name of the topic
	Name string `json:"name"`

	// Weight is the weight of the topic (0-1)
	Weight float64 `json:"weight"`

	// Keywords are related keywords for the topic
	Keywords []string `json:"keywords"`
}

// Marshal serializes the DocumentTopic to JSON
func (t *DocumentTopic) Marshal() ([]byte, error) {
	return json.Marshal(t)
}

// Unmarshal deserializes the DocumentTopic from JSON
func (t *DocumentTopic) Unmarshal(data []byte) error {
	return json.Unmarshal(data, t)
}

// TOCEntry represents an entry in a table of contents
type TOCEntry struct {
	// Level is the level of the entry
	Level int `json:"level"`

	// Title is the title of the entry
	Title string `json:"title"`

	// Position is the position of the entry in the document
	Position int `json:"position"`
}

// Marshal serializes the TOCEntry to JSON
func (e *TOCEntry) Marshal() ([]byte, error) {
	return json.Marshal(e)
}

// Unmarshal deserializes the TOCEntry from JSON
func (e *TOCEntry) Unmarshal(data []byte) error {
	return json.Unmarshal(data, e)
}

// DocumentAnalysis contains analysis of a document
type DocumentAnalysis struct {
	// ID is the unique identifier for the document
	ID string `json:"id"`

	// Sections are the sections of the document
	Sections []DocumentSection `json:"sections"`

	// Entities are entities extracted from the document
	Entities []DocumentEntity `json:"entities"`

	// Topics are topics extracted from the document
	Topics []DocumentTopic `json:"topics"`

	// TableOfContents is the table of contents for the document
	TableOfContents []TOCEntry `json:"table_of_contents"`

	// AnalyzedAt is the time the document was analyzed
	AnalyzedAt time.Time `json:"analyzed_at"`
}

// Marshal serializes the DocumentAnalysis to JSON
func (a *DocumentAnalysis) Marshal() ([]byte, error) {
	return json.Marshal(a)
}

// Unmarshal deserializes the DocumentAnalysis from JSON
func (a *DocumentAnalysis) Unmarshal(data []byte) error {
	return json.Unmarshal(data, a)
}

// DocumentChunk represents a chunk of a document for embedding and retrieval
type DocumentChunk struct {
	// ID is the unique identifier for the chunk
	ID string `json:"id"`

	// DocumentID is the ID of the document the chunk belongs to
	DocumentID string `json:"document_id"`

	// ChunkIndex is the index of the chunk
	ChunkIndex int `json:"chunk_index"`

	// Content is the content of the chunk
	Content string `json:"content"`

	// StartPosition is the position of the start of the chunk
	StartPosition int `json:"start_position"`

	// Length is the length of the chunk
	Length int `json:"length"`

	// Preview is a preview of the chunk content
	Preview string `json:"preview"`

	// Embedding is the embedding vector for the chunk
	Embedding []float64 `json:"embedding"`
}

// Marshal serializes the DocumentChunk to JSON
func (c *DocumentChunk) Marshal() ([]byte, error) {
	return json.Marshal(c)
}

// Unmarshal deserializes the DocumentChunk from JSON
func (c *DocumentChunk) Unmarshal(data []byte) error {
	return json.Unmarshal(data, c)
}

// Document represents a processed document
type Document struct {
	// ID is the unique identifier for the document
	ID string `json:"id"`

	// Metadata is the metadata for the document
	Metadata DocumentMetadata `json:"metadata"`

	// Analysis is the analysis of the document
	Analysis DocumentAnalysis `json:"analysis"`

	// Chunks are the chunks of the document
	Chunks []DocumentChunk `json:"chunks"`
}

// Marshal serializes the Document to JSON
func (d *Document) Marshal() ([]byte, error) {
	return json.Marshal(d)
}

// Unmarshal deserializes the Document from JSON
func (d *Document) Unmarshal(data []byte) error {
	return json.Unmarshal(data, d)
}

// DocumentMatch represents a match for a document search
type DocumentMatch struct {
	// DocumentID is the ID of the matching document
	DocumentID string `json:"document_id"`

	// ChunkID is the ID of the matching chunk
	ChunkID string `json:"chunk_id"`

	// Similarity is the similarity score of the match (0-1)
	Similarity float64 `json:"similarity"`

	// DocumentMeta is the metadata for the document
	DocumentMeta DocumentMetadata `json:"document_meta"`

	// ChunkContent is the content of the matching chunk
	ChunkContent string `json:"chunk_content"`

	// ChunkPreview is the preview of the matching chunk
	ChunkPreview string `json:"chunk_preview"`

	// MatchPosition is the position of the match in the document
	MatchPosition int `json:"match_position"`
}

// Marshal serializes the DocumentMatch to JSON
func (m *DocumentMatch) Marshal() ([]byte, error) {
	return json.Marshal(m)
}

// Unmarshal deserializes the DocumentMatch from JSON
func (m *DocumentMatch) Unmarshal(data []byte) error {
	return json.Unmarshal(data, m)
}
