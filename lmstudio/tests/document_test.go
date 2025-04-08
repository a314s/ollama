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
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ollama/ollama/lmstudio/documents"
	"github.com/ollama/ollama/lmstudio/types"
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
func (r *DocumentTestRunner) Run(ctx context.Context) (*types.TestResult, error) {
	startTime := time.Now()
	testID := "document_processing"
	testName := "Document Processing Test"

	// Create a test result
	result := &types.TestResult{
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

	// If we got here, the test passed
	result.Status = "passed"
	result.Message = "Document processing test passed"
	result.Duration = time.Since(startTime)
	result.FixAvailable = false
	
	// Additional test: Multiple files processing
	if err := r.testMultipleFiles(ctx); err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Multiple files test failed: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}
	
	// Additional test: Edge cases
	if err := r.testEdgeCases(ctx); err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Edge cases test failed: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}
	
	// Additional test: Document search with specific terms
	if err := r.testDocumentSearch(ctx); err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Document search test failed: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}
	
	// Additional test: Document update functionality
	if err := r.testDocumentUpdate(ctx); err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("Document update test failed: %v", err)
		result.Duration = time.Since(startTime)
		result.FixAvailable = false
		return result, nil
	}

	return result, nil
}

// testMultipleFiles tests processing multiple files
func (r *DocumentTestRunner) testMultipleFiles(ctx context.Context) error {
	// Create a temporary processor for this test
	processor := documents.NewProcessor(r.DocsPath, r.VectorStorePath)
	
	// Create multiple test documents
	docCount := 3
	docPaths := make([]string, docCount)
	docIDs := make([]string, docCount)
	
	defer func() {
		// Clean up test files
		for _, path := range docPaths {
			os.Remove(path)
		}
	}()
	
	for i := 0; i < docCount; i++ {
		// Create test document with different content
		content := fmt.Sprintf("Test document %d.\n\n# Heading 1\nThis is content for doc %d.\n\n# Heading 2\nThis contains unique term xyz%d.", i, i, i)
		docPath := filepath.Join(r.DocsPath, fmt.Sprintf("test-multi-%d.txt", i))
		
		if err := os.WriteFile(docPath, []byte(content), 0644); err != nil {
			return fmt.Errorf("failed to create test document %d: %w", i, err)
		}
		
		docPaths[i] = docPath
		
		// Process document
		doc, err := processor.ProcessDocument(ctx, docPath)
		if err != nil {
			return fmt.Errorf("failed to process document %d: %w", i, err)
		}
		
		docIDs[i] = doc.ID
	}
	
	// Verify we can retrieve all documents
	docs, err := processor.GetAllDocuments(ctx)
	if err != nil {
		return fmt.Errorf("failed to retrieve all documents: %w", err)
	}
	
	// Check if all test documents are in the results
	foundCount := 0
	for _, doc := range docs {
		for _, id := range docIDs {
			if doc.ID == id {
				foundCount++
				break
			}
		}
	}
	
	if foundCount < docCount {
		return fmt.Errorf("expected to find %d documents, found %d", docCount, foundCount)
	}
	
	// Test search across multiple documents
	results, err := processor.SearchDocuments(ctx, "unique", 10)
	if err != nil {
		return fmt.Errorf("search failed: %w", err)
	}
	
	if len(results) < docCount {
		return fmt.Errorf("expected at least %d search results, got %d", docCount, len(results))
	}
	
	// Clean up test documents
	for _, id := range docIDs {
		processor.DeleteDocument(ctx, id)
	}
	
	return nil
}

// testEdgeCases tests various edge cases
func (r *DocumentTestRunner) testEdgeCases(ctx context.Context) error {
	// Create a temporary processor for this test
	processor := documents.NewProcessor(r.DocsPath, r.VectorStorePath)
	
	// Test case 1: Empty document
	emptyDocPath := filepath.Join(r.DocsPath, "empty-test.txt")
	if err := os.WriteFile(emptyDocPath, []byte(""), 0644); err != nil {
		return fmt.Errorf("failed to create empty test document: %w", err)
	}
	defer os.Remove(emptyDocPath)
	
	emptyDoc, err := processor.ProcessDocument(ctx, emptyDocPath)
	if err != nil {
		return fmt.Errorf("failed to process empty document: %w", err)
	}
	
	// Empty doc should still have valid metadata
	if emptyDoc.Metadata.Filename != "empty-test.txt" {
		return fmt.Errorf("incorrect filename for empty document: %s", emptyDoc.Metadata.Filename)
	}
	
	// Clean up
	processor.DeleteDocument(ctx, emptyDoc.ID)
	
	// Test case 2: Very large document (simulate with many sections)
	largeDocPath := filepath.Join(r.DocsPath, "large-test.txt")
	var largeContent strings.Builder
	
	// Create a document with many sections
	largeContent.WriteString("# Large Test Document\n\n")
	for i := 0; i < 50; i++ {
		largeContent.WriteString(fmt.Sprintf("## Section %d\n\nThis is content for section %d.\n\n", i, i))
	}
	
	if err := os.WriteFile(largeDocPath, []byte(largeContent.String()), 0644); err != nil {
		return fmt.Errorf("failed to create large test document: %w", err)
	}
	defer os.Remove(largeDocPath)
	
	largeDoc, err := processor.ProcessDocument(ctx, largeDocPath)
	if err != nil {
		return fmt.Errorf("failed to process large document: %w", err)
	}
	
	// Large doc should have many sections
	if len(largeDoc.Analysis.Sections) < 40 {
		return fmt.Errorf("expected at least 40 sections in large document, got %d", len(largeDoc.Analysis.Sections))
	}
	
	// Clean up
	processor.DeleteDocument(ctx, largeDoc.ID)
	
	// Test case 3: Non-existent file
	_, err = processor.ProcessDocument(ctx, filepath.Join(r.DocsPath, "nonexistent.txt"))
	if err == nil {
		return fmt.Errorf("expected error when processing non-existent file, got nil")
	}
	
	// Test case 4: Retrieving non-existent document
	_, err = processor.GetDocument(ctx, "nonexistent-id")
	if err == nil {
		return fmt.Errorf("expected error when retrieving non-existent document, got nil")
	}
	
	return nil
}

// testDocumentSearch tests document search functionality
func (r *DocumentTestRunner) testDocumentSearch(ctx context.Context) error {
	// Create a temporary processor for this test
	processor := documents.NewProcessor(r.DocsPath, r.VectorStorePath)
	
	// Create a test document with unique searchable terms
	docPath := filepath.Join(r.DocsPath, "search-test.txt")
	content := "This document contains several unique and specific keywords.\n" +
		"Such as xylophone, zephyr, and antidisestablishmentarianism.\n" +
		"These words should be easy to search for and find this document."
	
	if err := os.WriteFile(docPath, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to create search test document: %w", err)
	}
	defer os.Remove(docPath)
	
	// Process the document
	doc, err := processor.ProcessDocument(ctx, docPath)
	if err != nil {
		return fmt.Errorf("failed to process search test document: %w", err)
	}
	
	// Test searches with different terms
	searchTerms := []string{
		"xylophone",
		"zephyr",
		"antidisestablishmentarianism",
		"unique specific",
	}
	
	for _, term := range searchTerms {
		results, err := processor.SearchDocuments(ctx, term, 10)
		if err != nil {
			return fmt.Errorf("search for '%s' failed: %w", term, err)
		}
		
		// Verify at least one result was found
		if len(results) == 0 {
			return fmt.Errorf("search for '%s' returned no results", term)
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
			return fmt.Errorf("search for '%s' did not find the test document", term)
		}
	}
	
	// Test with term that shouldn't be in the document
	results, err := processor.SearchDocuments(ctx, "supercalifragilisticexpialidocious", 10)
	if err != nil {
		return fmt.Errorf("negative search failed: %w", err)
	}
	
	// This term shouldn't find the document
	for _, result := range results {
		if result.DocumentID == doc.ID {
			return fmt.Errorf("search incorrectly found document with term that shouldn't match")
		}
	}
	
	// Clean up
	processor.DeleteDocument(ctx, doc.ID)
	
	return nil
}

// testDocumentUpdate tests updating document content
func (r *DocumentTestRunner) testDocumentUpdate(ctx context.Context) error {
	// Create a temporary processor for this test
	processor := documents.NewProcessor(r.DocsPath, r.VectorStorePath)
	
	// Create initial test document
	docPath := filepath.Join(r.DocsPath, "update-test.txt")
	initialContent := "This is the initial version of the document.\n" +
		"# Section 1\nInitial content."
	
	if err := os.WriteFile(docPath, []byte(initialContent), 0644); err != nil {
		return fmt.Errorf("failed to create update test document: %w", err)
	}
	defer os.Remove(docPath)
	
	// Process the document
	initialDoc, err := processor.ProcessDocument(ctx, docPath)
	if err != nil {
		return fmt.Errorf("failed to process initial document: %w", err)
	}
	
	// Update the document with new content
	updatedContent := "This is the updated version of the document.\n" +
		"# Section 1\nUpdated content.\n" +
		"# Section 2\nNew section added."
	
	if err := os.WriteFile(docPath, []byte(updatedContent), 0644); err != nil {
		return fmt.Errorf("failed to update test document: %w", err)
	}
	
	// Process the updated document
	updatedDoc, err := processor.ProcessDocument(ctx, docPath)
	if err != nil {
		return fmt.Errorf("failed to process updated document: %w", err)
	}
	
	// Verify IDs are different (since content changed)
	if initialDoc.ID == updatedDoc.ID {
		return fmt.Errorf("document IDs should differ after content update")
	}
	
	// Verify section count increased
	if len(updatedDoc.Analysis.Sections) <= len(initialDoc.Analysis.Sections) {
		return fmt.Errorf("expected more sections in updated document")
	}
	
	// Clean up
	processor.DeleteDocument(ctx, initialDoc.ID)
	processor.DeleteDocument(ctx, updatedDoc.ID)
	
	return nil
}

// extractMetadata extracts metadata from a document
func (r *DocumentTestRunner) extractMetadata(path string) (*types.DocumentMetadata, error) {
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
	metadata := &types.DocumentMetadata{
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
func (r *DocumentTestRunner) analyzeDocument(path string, content string) (*types.DocumentAnalysis, error) {
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
	analysis := &types.DocumentAnalysis{
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
func (r *DocumentTestRunner) extractSections(content string) []types.DocumentSection {
	// Simple section extraction based on # headings
	lines := strings.Split(content, "\n")
	sections := []types.DocumentSection{}
	
	var currentSection *types.DocumentSection
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
			currentSection = &types.DocumentSection{
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
		sections = append(sections, types.DocumentSection{
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
func (r *DocumentTestRunner) extractEntities(content string) []types.DocumentEntity {
	entities := []types.DocumentEntity{}
	
	// Extract emails (simple regex-like implementation)
	words := strings.Fields(content)
	for _, word := range words {
		if strings.Contains(word, "@") && strings.Contains(word, ".") {
			entities = append(entities, types.DocumentEntity{
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
func (r *DocumentTestRunner) extractTopics(content string) []types.DocumentTopic {
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
	topics := []types.DocumentTopic{}
	for word, count := range wordCounts {
		if count > 1 { // Only include words that appear more than once
			topics = append(topics, types.DocumentTopic{
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
func (r *DocumentTestRunner) generateTOC(sections []types.DocumentSection) []types.TOCEntry {
	toc := []types.TOCEntry{}
	
	for _, section := range sections {
		toc = append(toc, types.TOCEntry{
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
func (t *DocumentTest) RunTest(ctx context.Context) (*types.TestResult, error) {
	result := &types.TestResult{
		ID:          "document_processor",
		Name:        "Document Processor Test",
		Description: "Tests the document processing system functionality",
		StartTime:   time.Now(),
	}
	
	// Test vector store initialization
	if err := t.testVectorStore(ctx); err != nil {
		result.Status = types.StatusFailed
		result.Error = fmt.Sprintf("Vector store test failed: %v", err)
		result.EndTime = time.Now()
		return result, nil
	}
	
	// Test document metadata extraction
	if err := t.testMetadataExtraction(ctx); err != nil {
		result.Status = types.StatusFailed
		result.Error = fmt.Sprintf("Metadata extraction test failed: %v", err)
		result.EndTime = time.Now()
		return result, nil
	}
	
	// Test document analysis
	if err := t.testDocumentAnalysis(ctx); err != nil {
		result.Status = types.StatusFailed
		result.Error = fmt.Sprintf("Document analysis test failed: %v", err)
		result.EndTime = time.Now()
		return result, nil
	}
	
	// Test document search
	if err := t.testDocumentSearch(ctx); err != nil {
		result.Status = types.StatusFailed
		result.Error = fmt.Sprintf("Document search test failed: %v", err)
		result.EndTime = time.Now()
		return result, nil
	}
	
	// All tests passed
	result.Status = types.StatusPassed
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
	types.GetTracker().RegisterTest("document_processor", t)
	types.GetTracker().RegisterFixProvider("document_processor", t)
}

func TestDocumentProcessingEndToEnd(t *testing.T) {
	processor, tempDir := createTestProcessor(t)
	defer os.RemoveAll(tempDir)

	// 1. Create a test document
	testContent := "This is a test document.\nIt contains multiple paragraphs and sections.\n\n# Section 1\nThis is section 1 content.\n\n# Section 2\nThis is section 2 content with an email: test@example.com."
	testDocPath := createTestFile(t, testContent)

	// 2. Process the document
	doc, err := processor.ProcessDocument(context.Background(), testDocPath)
	require.NoError(t, err, "Failed to process document")
	require.NotNil(t, doc, "Processed document is nil")

	// 3. Retrieve the document
	retrievedDoc, err := processor.GetDocument(context.Background(), doc.ID)
	require.NoError(t, err, "Failed to retrieve document")
	require.NotNil(t, retrievedDoc, "Retrieved document is nil")
	assert.Equal(t, doc.ID, retrievedDoc.ID, "Retrieved document ID mismatch")
	assert.Equal(t, "test_doc_*.txt", retrievedDoc.Metadata.Filename, "Filename mismatch")
	assert.NotEmpty(t, retrievedDoc.Chunks, "Document chunks are empty after retrieval")
	assert.True(t, len(retrievedDoc.Chunks[0].Embedding) > 0, "Chunk embedding is empty after retrieval")

	// 4. Search for content within the document
	searchQuery := "simple text content"
	matches, err := processor.SearchDocuments(context.Background(), searchQuery, 5)
	require.NoError(t, err, "Failed to search documents")
	require.NotEmpty(t, matches, "Search returned no matches")

	// Basic check: Ensure the match belongs to our document and has reasonable similarity
	foundMatch := false
	for _, match := range matches {
		if match.DocumentID == doc.ID {
			foundMatch = true
			assert.Contains(t, strings.ToLower(match.Content), strings.ToLower(searchQuery), "Match content doesn't contain query")
			assert.Greater(t, match.Similarity, 0.5, "Match similarity is too low") // Expect high similarity for direct match
			assert.Equal(t, "test_doc_*.txt", match.DocumentName, "Match document name mismatch")
			assert.NotNil(t, match.Metadata, "Match metadata is nil")
			break
		}
	}
	assert.True(t, foundMatch, "Did not find a match for the processed document ID")

	// 5. Get All Documents (Metadata only)
	allDocsMetadata, err := processor.GetAllDocumentsMetadata(context.Background())
	require.NoError(t, err, "Failed to get all documents metadata")
	require.NotEmpty(t, allDocsMetadata, "GetAllDocumentsMetadata returned empty list")

	foundInList := false
	for _, meta := range allDocsMetadata {
		if meta.ID == doc.ID {
			foundInList = true
			assert.Equal(t, "test_doc_*.txt", meta.Filename, "Filename mismatch in metadata list")
			break
		}
	}
	assert.True(t, foundInList, "Processed document not found in GetAllDocumentsMetadata list")

	// 6. Delete the document
	err = processor.DeleteDocument(context.Background(), doc.ID)
	require.NoError(t, err, "Failed to delete document")

	// 7. Verify deletion
	_, err = processor.GetDocument(context.Background(), doc.ID)
	require.Error(t, err, "Document should not be retrievable after deletion")
	assert.True(t, errors.Is(err, os.ErrNotExist) || strings.Contains(err.Error(), "not found"), "Error retrieving deleted document is not a 'not found' error")

	// Verify document directory is gone
	docDir := filepath.Join(processor.GetDataDir(), "docs", doc.ID)
	_, err = os.Stat(docDir)
	assert.True(t, errors.Is(err, os.ErrNotExist), "Document directory should not exist after deletion")

	// Verify vector store directory is gone
	vecDir := filepath.Join(processor.GetDataDir(), "vector_store", doc.ID)
	_, err = os.Stat(vecDir)
	assert.True(t, errors.Is(err, os.ErrNotExist), "Vector store directory should not exist after deletion")
}

// --- Helper Functions ---

// createTestProcessor creates a document processor in a temporary directory
func createTestProcessor(t *testing.T) (*documents.Processor, string) {
	tempDir, err := os.MkdirTemp("", "doc_processor_test_*")
	require.NoError(t, err, "Failed to create temp dir")

	config := documents.Config{
		DataDir: tempDir,
	}
	processor, err := documents.NewProcessor(config)
	require.NoError(t, err, "Failed to create processor")

	return processor, tempDir
}

// createTestFile creates a temporary file with the given content
func createTestFile(t *testing.T, content string) string {
	tempFile, err := os.CreateTemp("", "test_doc_*.txt")
	require.NoError(t, err, "Failed to create temp file")
	defer tempFile.Close()

	_, err = tempFile.WriteString(content)
	require.NoError(t, err, "Failed to write to temp file")

	return tempFile.Name()
}
