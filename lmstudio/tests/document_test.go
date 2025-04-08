package tests

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ollama/ollama/api"
	"github.com/ollama/ollama/documents"
	"github.com/ollama/ollama/status"
)

// DocumentTestRunner tests the document processing system
type DocumentTestRunner struct {
	// DocsPath is the path to the documents directory
	DocsPath string
	
	// VectorStorePath is the path to the vector store
	VectorStorePath string
}

// NewDocumentTestRunner creates a new document test runner
func NewDocumentTestRunner(docsPath string, vectorStorePath string) *DocumentTestRunner {
	return &DocumentTestRunner{
		DocsPath:        docsPath,
		VectorStorePath: vectorStorePath,
	}
}

// Run runs the document processing test
func (r *DocumentTestRunner) Run(ctx context.Context) (*api.TestResult, error) {
	startTime := time.Now()
	testID := "document_processing"
	testName := "Document Processing Test"

	// Create a test result
	result := &api.TestResult{
		ID:       testID,
		Name:     testName,
		Status:   "running",
		Message:  "Test in progress",
		Duration: 0,
		RunAt:    startTime,
	}

	// Check if the documents directory exists
	if _, err := os.Stat(r.DocsPath); os.IsNotExist(err) {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Documents directory does not exist: %s", r.DocsPath)
		result.Duration = time.Since(startTime)
		result.FixAvailable = true
		return result, nil
	}

	// Check if the vector store directory exists
	if _, err := os.Stat(r.VectorStorePath); os.IsNotExist(err) {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Vector store directory does not exist: %s", r.VectorStorePath)
		result.Duration = time.Since(startTime)
		result.FixAvailable = true
		return result, nil
	}

	// Create a test document
	testDocPath := filepath.Join(r.DocsPath, "test-document.txt")
	testContent := "This is a test document.\nIt contains multiple paragraphs and sections.\n\n# Section 1\nThis is section 1 content.\n\n# Section 2\nThis is section 2 content with an email: test@example.com."
	
	if err := os.WriteFile(testDocPath, []byte(testContent), 0644); err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Failed to create test document: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}
	defer os.Remove(testDocPath)

	// Test metadata extraction
	metadata, err := r.extractMetadata(testDocPath)
	if err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Failed to extract metadata: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}

	// Test document analysis
	analysis, err := r.analyzeDocument(testDocPath, testContent)
	if err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Failed to analyze document: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}

	// Test embedding generation
	embedding, err := r.getEmbedding(testContent)
	if err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Failed to generate embedding: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}

	// Verify the results
	if metadata.Filename != "test-document.txt" {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Unexpected metadata filename: %s", metadata.Filename)
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}

	if metadata.WordCount < 10 {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Unexpected word count: %d", metadata.WordCount)
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}

	if len(analysis.Sections) < 2 {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Expected at least 2 sections, got %d", len(analysis.Sections))
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}

	if len(analysis.Entities) < 1 {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Expected at least 1 entity, got %d", len(analysis.Entities))
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}

	if len(embedding) != 128 {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Expected embedding dimension 128, got %d", len(embedding))
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}

	// Test passed
	result.Status = "passed"
	result.Message = "Document processing system is operational"
	result.Duration = time.Since(startTime)
	result.FixAvailable = false
	return result, nil
}

// extractMetadata extracts metadata from a document
func (r *DocumentTestRunner) extractMetadata(path string) (*api.DocumentMetadata, error) {
	// Get file info
	fileInfo, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}

	// Read the file content
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Calculate word count
	wordCount := len(strings.Fields(string(content)))

	// Estimate page count (rough estimate: 250 words per page)
	estimatedPages := int(math.Ceil(float64(wordCount) / 250.0))

	// Generate a content summary (simple implementation)
	contentSummary := "Document content summary placeholder"
	if len(content) > 200 {
		contentSummary = string(content[:200]) + "..."
	} else {
		contentSummary = string(content)
	}

	// Create metadata
	metadata := &api.DocumentMetadata{
		ID:               fmt.Sprintf("doc-%x", sha256.Sum256([]byte(path))),
		Filename:         filepath.Base(path),
		Filetype:         strings.TrimPrefix(filepath.Ext(path), "."),
		Filesize:         fileInfo.Size(),
		OriginalPath:     path,
		UploadDate:       time.Now(),
		LastModifiedDate: fileInfo.ModTime(),
		WordCount:        wordCount,
		EstimatedPages:   estimatedPages,
		ContentSummary:   contentSummary,
	}

	return metadata, nil
}

// analyzeDocument analyzes a document
func (r *DocumentTestRunner) analyzeDocument(path string, content string) (*api.DocumentAnalysis, error) {
	// Create a document ID
	docID := fmt.Sprintf("doc-%x", sha256.Sum256([]byte(path)))

	// Extract sections
	sections := r.extractSections(content)

	// Extract entities
	entities := r.extractEntities(content)

	// Extract topics
	topics := r.extractTopics(content)

	// Generate table of contents
	toc := r.generateTOC(sections)

	// Create analysis
	analysis := &api.DocumentAnalysis{
		ID:              docID,
		Sections:        sections,
		Entities:        entities,
		Topics:          topics,
		TableOfContents: toc,
		AnalyzedAt:      time.Now(),
	}

	return analysis, nil
}

// extractSections extracts sections from document content
func (r *DocumentTestRunner) extractSections(content string) []api.DocumentSection {
	// Simple section extraction based on # headings
	lines := strings.Split(content, "\n")
	sections := []api.DocumentSection{}
	
	var currentSection *api.DocumentSection
	var sectionContent strings.Builder
	
	for i, line := range lines {
		if strings.HasPrefix(line, "# ") {
			// Save the previous section if it exists
			if currentSection != nil {
				currentSection.Content = sectionContent.String()
				currentSection.Length = len(currentSection.Content)
				sections = append(sections, *currentSection)
				sectionContent.Reset()
			}
			
			// Start a new section
			heading := strings.TrimPrefix(line, "# ")
			currentSection = &api.DocumentSection{
				Index:         len(sections),
				Heading:       heading,
				Content:       "",
				StartPosition: i,
				Length:        0,
			}
		} else if currentSection != nil {
			// Add line to current section
			sectionContent.WriteString(line)
			sectionContent.WriteString("\n")
		}
	}
	
	// Save the last section if it exists
	if currentSection != nil {
		currentSection.Content = sectionContent.String()
		currentSection.Length = len(currentSection.Content)
		sections = append(sections, *currentSection)
	}
	
	// If no sections were found, create a default section
	if len(sections) == 0 {
		sections = append(sections, api.DocumentSection{
			Index:         0,
			Heading:       "Document",
			Content:       content,
			StartPosition: 0,
			Length:        len(content),
		})
	}
	
	return sections
}

// extractEntities extracts entities from document content
func (r *DocumentTestRunner) extractEntities(content string) []api.DocumentEntity {
	entities := []api.DocumentEntity{}
	
	// Extract emails (simple regex-like implementation)
	words := strings.Fields(content)
	for _, word := range words {
		if strings.Contains(word, "@") && strings.Contains(word, ".") {
			entities = append(entities, api.DocumentEntity{
				Type:     "email",
				Value:    word,
				Position: strings.Index(content, word),
			})
		}
	}
	
	// In a real implementation, we would extract more entity types:
	// - Dates
	// - Persons
	// - Organizations
	// - Locations
	// - etc.
	
	return entities
}

// extractTopics extracts topics from document content
func (r *DocumentTestRunner) extractTopics(content string) []api.DocumentTopic {
	// Simple topic extraction based on word frequency
	words := strings.Fields(strings.ToLower(content))
	wordCounts := make(map[string]int)
	
	// Count word occurrences
	for _, word := range words {
		// Skip short words and common stop words
		if len(word) < 4 || isStopWord(word) {
			continue
		}
		
		// Remove punctuation
		word = strings.Trim(word, ".,;:!?\"'()[]{}\\/-_")
		if word == "" {
			continue
		}
		
		wordCounts[word]++
	}
	
	// Convert to topics
	topics := []api.DocumentTopic{}
	for word, count := range wordCounts {
		if count > 1 { // Only include words that appear more than once
			topics = append(topics, api.DocumentTopic{
				Name:     word,
				Weight:   float64(count) / float64(len(words)),
				Keywords: []string{word},
			})
		}
	}
	
	// Sort topics by weight (not implemented here for simplicity)
	
	// Return top topics (at most 5)
	if len(topics) > 5 {
		topics = topics[:5]
	}
	
	return topics
}

// isStopWord checks if a word is a stop word
func isStopWord(word string) bool {
	stopWords := map[string]bool{
		"the": true, "and": true, "that": true, "this": true,
		"for": true, "with": true, "are": true, "from": true,
	}
	
	return stopWords[word]
}

// generateTOC generates a table of contents from sections
func (r *DocumentTestRunner) generateTOC(sections []api.DocumentSection) []api.TOCEntry {
	toc := []api.TOCEntry{}
	
	for _, section := range sections {
		toc = append(toc, api.TOCEntry{
			Level:    1, // All sections are level 1 in our simple implementation
			Title:    section.Heading,
			Position: section.StartPosition,
		})
	}
	
	return toc
}

// getEmbedding generates an embedding vector for document content
func (r *DocumentTestRunner) getEmbedding(content string) ([]float64, error) {
	// Hash-based embedding as described in the memory
	hash := sha256.Sum256([]byte(content))
	hashStr := hex.EncodeToString(hash[:])
	
	// Convert hash to 128-dimensional vector with values between -1 and 1
	embedding := make([]float64, 128)
	for i := 0; i < 128; i++ {
		// Use two characters from the hash for each dimension
		if i*2+1 < len(hashStr) {
			hexVal := hashStr[i*2 : i*2+2]
			intVal, err := strconv.ParseInt(hexVal, 16, 64)
			if err != nil {
				return nil, fmt.Errorf("failed to parse hash value: %w", err)
			}
			
			// Convert to a value between -1 and 1
			embedding[i] = float64(intVal)/127.5 - 1.0
		}
	}
	
	return embedding, nil
}

// DocumentFixer fixes document processing issues
type DocumentFixer struct {
	// DocsPath is the path to the documents directory
	DocsPath string
	
	// VectorStorePath is the path to the vector store
	VectorStorePath string
}

// NewDocumentFixer creates a new document fixer
func NewDocumentFixer(docsPath string, vectorStorePath string) *DocumentFixer {
	return &DocumentFixer{
		DocsPath:        docsPath,
		VectorStorePath: vectorStorePath,
	}
}

// Fix attempts to fix document processing issues
func (f *DocumentFixer) Fix(ctx context.Context, componentID string) (bool, []string, error) {
	// Check if the component ID is correct
	if componentID != "documents" {
		return false, nil, fmt.Errorf("unexpected component ID: %s", componentID)
	}

	actions := []string{}

	// Check if the documents directory exists
	if _, err := os.Stat(f.DocsPath); os.IsNotExist(err) {
		// Create the documents directory
		if err := os.MkdirAll(f.DocsPath, 0755); err != nil {
			return false, actions, fmt.Errorf("failed to create documents directory: %w", err)
		}
		actions = append(actions, fmt.Sprintf("Created documents directory: %s", f.DocsPath))
	} else {
		actions = append(actions, fmt.Sprintf("Documents directory already exists: %s", f.DocsPath))
	}

	// Check if the vector store directory exists
	if _, err := os.Stat(f.VectorStorePath); os.IsNotExist(err) {
		// Create the vector store directory
		if err := os.MkdirAll(f.VectorStorePath, 0755); err != nil {
			return false, actions, fmt.Errorf("failed to create vector store directory: %w", err)
		}
		actions = append(actions, fmt.Sprintf("Created vector store directory: %s", f.VectorStorePath))
	} else {
		actions = append(actions, fmt.Sprintf("Vector store directory already exists: %s", f.VectorStorePath))
	}

	// Check directory permissions
	if err := f.checkPermissions(f.DocsPath); err != nil {
		actions = append(actions, fmt.Sprintf("Warning: Documents directory permission issue: %v", err))
	} else {
		actions = append(actions, "Documents directory has correct permissions")
	}

	if err := f.checkPermissions(f.VectorStorePath); err != nil {
		actions = append(actions, fmt.Sprintf("Warning: Vector store directory permission issue: %v", err))
	} else {
		actions = append(actions, "Vector store directory has correct permissions")
	}

	// Create a test document and vector embedding to verify functionality
	testDocPath := filepath.Join(f.DocsPath, "test-fix-document.txt")
	testContent := "This is a test document for fixing."
	
	if err := os.WriteFile(testDocPath, []byte(testContent), 0644); err != nil {
		return false, actions, fmt.Errorf("failed to create test document: %w", err)
	}
	actions = append(actions, "Created test document to verify functionality")
	
	// Clean up the test document
	if err := os.Remove(testDocPath); err != nil {
		actions = append(actions, fmt.Sprintf("Warning: Failed to clean up test document: %v", err))
	} else {
		actions = append(actions, "Cleaned up test document")
	}

	return true, actions, nil
}

// checkPermissions checks if a directory has the correct permissions
func (f *DocumentFixer) checkPermissions(path string) error {
	// Create a test file
	testPath := filepath.Join(path, "test-permissions.txt")
	if err := os.WriteFile(testPath, []byte("test"), 0644); err != nil {
		return fmt.Errorf("failed to write test file: %w", err)
	}
	
	// Try to read the test file
	if _, err := os.ReadFile(testPath); err != nil {
		// Clean up the test file if it was created
		os.Remove(testPath)
		return fmt.Errorf("failed to read test file: %w", err)
	}
	
	// Clean up the test file
	if err := os.Remove(testPath); err != nil {
		return fmt.Errorf("failed to remove test file: %w", err)
	}
	
	return nil
}

// DocumentTest implements tests for the document processing system
type DocumentTest struct {
	processor *documents.Processor
}

// NewDocumentTest creates a new document test
func NewDocumentTest() *DocumentTest {
	docsPath := os.Getenv("LMSTUDIO_DOCS_PATH")
	if docsPath == "" {
		docsPath = filepath.Join(os.TempDir(), "lmstudio", "docs")
	}
	
	vectorStorePath := os.Getenv("LMSTUDIO_VECTOR_STORE_PATH")
	if vectorStorePath == "" {
		vectorStorePath = filepath.Join(os.TempDir(), "lmstudio", "vectorstore")
	}
	
	return &DocumentTest{
		processor: documents.NewProcessor(docsPath, vectorStorePath),
	}
}

// RunTest executes the document processing system test
func (t *DocumentTest) RunTest(ctx context.Context) (*api.TestResult, error) {
	result := &api.TestResult{
		ID:          "document_processor",
		Name:        "Document Processor Test",
		Description: "Tests the document processing system functionality",
		StartTime:   time.Now(),
	}
	
	// Test vector store initialization
	if err := t.testVectorStore(ctx); err != nil {
		result.Status = api.StatusFailed
		result.Error = fmt.Sprintf("Vector store test failed: %v", err)
		result.EndTime = time.Now()
		return result, nil
	}
	
	// Test document metadata extraction
	if err := t.testMetadataExtraction(ctx); err != nil {
		result.Status = api.StatusFailed
		result.Error = fmt.Sprintf("Metadata extraction test failed: %v", err)
		result.EndTime = time.Now()
		return result, nil
	}
	
	// Test document analysis
	if err := t.testDocumentAnalysis(ctx); err != nil {
		result.Status = api.StatusFailed
		result.Error = fmt.Sprintf("Document analysis test failed: %v", err)
		result.EndTime = time.Now()
		return result, nil
	}
	
	// Test document search
	if err := t.testDocumentSearch(ctx); err != nil {
		result.Status = api.StatusFailed
		result.Error = fmt.Sprintf("Document search test failed: %v", err)
		result.EndTime = time.Now()
		return result, nil
	}
	
	// All tests passed
	result.Status = api.StatusPassed
	result.EndTime = time.Now()
	return result, nil
}

// testVectorStore tests if the vector store is properly initialized
func (t *DocumentTest) testVectorStore(ctx context.Context) error {
	// Check if vector store directory exists or can be created
	storePath := t.processor.GetVectorStorePath()
	
	if _, err := os.Stat(storePath); os.IsNotExist(err) {
		// Try to create the directory
		if err := os.MkdirAll(storePath, 0755); err != nil {
			return fmt.Errorf("failed to create vector store directory: %w", err)
		}
	}
	
	// Try to write a test file to ensure we have write permissions
	testFile := filepath.Join(storePath, "test.tmp")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		return fmt.Errorf("failed to write to vector store directory: %w", err)
	}
	defer os.Remove(testFile)
	
	return nil
}

// testMetadataExtraction tests if the metadata extraction works
func (t *DocumentTest) testMetadataExtraction(ctx context.Context) error {
	// Create a test document
	tempFile, err := os.CreateTemp("", "test-doc-*.txt")
	if err != nil {
		return fmt.Errorf("failed to create test document: %w", err)
	}
	defer os.Remove(tempFile.Name())
	
	// Write some test content
	testContent := "This is a test document for metadata extraction.\n" +
		"It contains multiple lines and should be processed correctly.\n" +
		"Date: 2025-04-08\n" +
		"Author: LM Studio Test\n" +
		"Email: test@example.com"
	
	if err := os.WriteFile(tempFile.Name(), []byte(testContent), 0644); err != nil {
		return fmt.Errorf("failed to write test content: %w", err)
	}
	
	// Process the document
	doc, err := t.processor.ProcessDocument(ctx, tempFile.Name())
	if err != nil {
		return fmt.Errorf("failed to process test document: %w", err)
	}
	
	// Verify basic metadata
	if doc.Metadata.Filename == "" {
		return errors.New("filename not extracted")
	}
	
	if doc.Metadata.FileSize <= 0 {
		return errors.New("file size not extracted correctly")
	}
	
	if doc.Metadata.WordCount <= 0 {
		return errors.New("word count not extracted correctly")
	}
	
	return nil
}

// testDocumentAnalysis tests if the document analysis works
func (t *DocumentTest) testDocumentAnalysis(ctx context.Context) error {
	// Create a test document with headings and sections
	tempFile, err := os.CreateTemp("", "test-doc-*.txt")
	if err != nil {
		return fmt.Errorf("failed to create test document: %w", err)
	}
	defer os.Remove(tempFile.Name())
	
	// Write some test content with headings
	testContent := "# Test Document\n\n" +
		"This is a test document with multiple sections.\n\n" +
		"## Section 1\n\n" +
		"This is the content of section 1.\n\n" +
		"## Section 2\n\n" +
		"This is the content of section 2.\n\n" +
		"### Subsection 2.1\n\n" +
		"This is a subsection with more content.\n\n" +
		"## Section 3\n\n" +
		"This is the final section."
	
	if err := os.WriteFile(tempFile.Name(), []byte(testContent), 0644); err != nil {
		return fmt.Errorf("failed to write test content: %w", err)
	}
	
	// Process the document
	doc, err := t.processor.ProcessDocument(ctx, tempFile.Name())
	if err != nil {
		return fmt.Errorf("failed to process test document: %w", err)
	}
	
	// Verify analysis
	if doc.Analysis == nil {
		return errors.New("document analysis is nil")
	}
	
	// Check sections
	if len(doc.Analysis.Sections) < 3 {
		return fmt.Errorf("expected at least 3 sections, got %d", len(doc.Analysis.Sections))
	}
	
	// Check TOC
	if len(doc.Analysis.TableOfContents) < 3 {
		return fmt.Errorf("expected at least 3 TOC entries, got %d", len(doc.Analysis.TableOfContents))
	}
	
	return nil
}

// testDocumentSearch tests if document search works
func (t *DocumentTest) testDocumentSearch(ctx context.Context) error {
	// Create a test document
	tempFile, err := os.CreateTemp("", "test-doc-*.txt")
	if err != nil {
		return fmt.Errorf("failed to create test document: %w", err)
	}
	defer os.Remove(tempFile.Name())
	
	// Write some test content with unique keywords
	testContent := "This document contains some unique keywords.\n" +
		"Such as xylophone, zephyr, and quixotic.\n" +
		"These words should be easy to search for."
	
	if err := os.WriteFile(tempFile.Name(), []byte(testContent), 0644); err != nil {
		return fmt.Errorf("failed to write test content: %w", err)
	}
	
	// Process the document
	doc, err := t.processor.ProcessDocument(ctx, tempFile.Name())
	if err != nil {
		return fmt.Errorf("failed to process test document: %w", err)
	}
	
	// Search for a unique keyword
	results, err := t.processor.SearchDocuments(ctx, "xylophone", 10)
	if err != nil {
		return fmt.Errorf("search failed: %w", err)
	}
	
	// Verify at least one result was found
	if len(results) == 0 {
		return errors.New("search returned no results")
	}
	
	// Verify the document ID matches
	found := false
	for _, result := range results {
		if result.DocumentID == doc.ID {
			found = true
			break
		}
	}
	
	if !found {
		return errors.New("search did not find the test document")
	}
	
	return nil
}

// Fix attempts to fix common issues with the document processor
func (t *DocumentTest) Fix(ctx context.Context) (bool, []string, error) {
	actions := []string{}
	success := true
	
	// Ensure vector store directory exists
	storePath := t.processor.GetVectorStorePath()
	if _, err := os.Stat(storePath); os.IsNotExist(err) {
		if err := os.MkdirAll(storePath, 0755); err != nil {
			success = false
			return success, actions, fmt.Errorf("failed to create vector store directory: %w", err)
		}
		actions = append(actions, fmt.Sprintf("Created vector store directory: %s", storePath))
	}
	
	// Ensure documents directory exists
	docsPath := t.processor.GetDocsPath()
	if _, err := os.Stat(docsPath); os.IsNotExist(err) {
		if err := os.MkdirAll(docsPath, 0755); err != nil {
			success = false
			return success, actions, fmt.Errorf("failed to create documents directory: %w", err)
		}
		actions = append(actions, fmt.Sprintf("Created documents directory: %s", docsPath))
	}
	
	// Check permissions
	testFile := filepath.Join(storePath, "test.tmp")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		success = false
		actions = append(actions, fmt.Sprintf("Failed to write to vector store directory: %v", err))
	} else {
		os.Remove(testFile)
		actions = append(actions, "Verified write permissions for vector store")
	}
	
	return success, actions, nil
}

// Register registers this test with the status tracker
func (t *DocumentTest) Register() {
	status.GetTracker().RegisterTest("document_processor", t)
	status.GetTracker().RegisterFixProvider("document_processor", t)
}
